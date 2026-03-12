import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Textarea, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import FormField from 'src/components/shared/FormField';
import { clienteService, Cliente } from 'src/services/clienteService';
import useClienteValidation, { ClienteFormData } from 'src/hooks/useClienteValidation';

const SectionHeader: React.FC<{ title: string; icon: string }> = ({ title, icon }) => (
  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
    <Icon icon={icon} className="w-4 h-4 text-primary" />
    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">{title}</h3>
  </div>
);

interface NuevoClienteProps {
  clienteToEdit?: Cliente;
  isEditMode?: boolean;
  onSaveSuccess?: (clienteActualizado?: Cliente) => void;
}

const NuevoCliente: React.FC<NuevoClienteProps> = ({
  clienteToEdit,
  isEditMode = false,
  onSaveSuccess,
}) => {
  const normalizeGeneroToUi = (value?: string) => {
    const v = (value || '').toString().trim().toUpperCase();
    if (v === 'M' || v === 'MASCULINO') return 'masculino';
    if (v === 'F' || v === 'FEMENINO') return 'femenino';
    if (v === 'O' || v === 'OTRO') return 'otro';
    return (value || '').toString().trim().toLowerCase();
  };

  const normalizeDateToISO = (value?: string) => {
    const v = (value || '').toString().trim();
    if (!v) return '';
    // Manejar formatos comunes: 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS', 'YYYY-MM-DDTHH:MM:SSZ'
    if (v.length >= 10) {
      const candidate = v.substring(0, 10);
      // Validar patrón simple YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
    }
    // Fallback: intentar parsear
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  };
  const normalizeEstadoToUi = (value?: string) => {
    const v = (value || '').toString().trim().toLowerCase();
    if (v === 'active' || v === 'activo') return 'activo';
    if (v === 'inactive' || v === 'inactivo') return 'inactivo';
    if (v === 'blocked' || v === 'bloqueado') return 'inactivo';
    return 'prospecto'; // incluye 'prospect' o valores desconocidos
  };
  const [formData, setFormData] = useState<ClienteFormData>({
    client_type: 'persona',
    nombre: clienteToEdit?.nombre || '',
    apellidos: clienteToEdit?.apellidos || '',
    cuit: clienteToEdit?.cuit || '',
    tipo_documento: clienteToEdit?.tipo_documento || '',
    fecha_expedicion_documento: (clienteToEdit as any)?.fecha_expedicion_documento || '',
    fecha_nacimiento: clienteToEdit?.fecha_nacimiento || '',
    genero: clienteToEdit?.genero || '',
    domicilio_principal: clienteToEdit?.domicilio_principal || '',
    celular_principal: clienteToEdit?.celular_principal || '',
    email_principal: clienteToEdit?.email_principal || '',
    actividad: clienteToEdit?.actividad || '',
    ciudad: clienteToEdit?.ciudad || '',
    department:
      (clienteToEdit as any)?.department ||
      (clienteToEdit as any)?.state ||
      (clienteToEdit as any)?.departamento ||
      '',
    branch_name: (clienteToEdit as any)?.branch_name || (clienteToEdit as any)?.sede || '',
    estado: normalizeEstadoToUi(clienteToEdit?.estado || 'activo'),
    observaciones: clienteToEdit?.observaciones || '',
    razon_social: '',
    representante_legal: '',
    representante_legal_tipo_documento: '',
    representante_legal_documento: '',
    etiquetas: (clienteToEdit as any)?.etiquetas || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const { errors, clearError } = useClienteValidation();
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  
  // Estado para validación de documento duplicado
  const [documentoError, setDocumentoError] = useState<string | null>(null);
  const [checkingDocumento, setCheckingDocumento] = useState(false);
  const documentoCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Verificar si todos los campos obligatorios están completos (sin mostrar errores)
  const canSave = useCallback((): boolean => {
    const isEmpresa = formData.client_type === 'empresa';
    
    // Campos obligatorios del paso 1
    if (!formData.client_type) return false;
    if (!isEmpresa) {
      if (!formData.nombre?.trim()) return false;
      if (!formData.apellidos?.trim()) return false;
      if (!formData.genero) return false;
    } else {
      if (!formData.razon_social?.trim()) return false;
    }
    if (!formData.cuit?.trim() || formData.cuit.trim().length < 6) return false;
    if (!formData.tipo_documento) return false;
    if (!formData.email_principal?.trim()) return false;
    if (!formData.celular_principal?.trim()) return false;
    
    // Campos obligatorios del paso 2
    if (!formData.domicilio_principal?.trim() || formData.domicilio_principal.trim().length < 5) return false;
    if (!formData.ciudad?.trim()) return false;
    if (!formData.department?.trim()) return false;
    if (!formData.estado) return false;
    
    // No permitir guardar si hay error de documento duplicado (solo en modo crear, no en editar)
    if (documentoError && !isEditMode) return false;
    
    return true;
  }, [formData, documentoError, isEditMode]);
  
  // Verificar documento duplicado con debounce
  useEffect(() => {
    if (documentoCheckRef.current) {
      clearTimeout(documentoCheckRef.current);
    }
    
    const documento = formData.cuit?.trim();
    if (!documento || documento.length < 5) {
      setDocumentoError(null);
      setCheckingDocumento(false);
      return;
    }
    
    setCheckingDocumento(true);
    documentoCheckRef.current = setTimeout(async () => {
      try {
        console.log('🔍 Iniciando verificación de documento:', documento);
        const result = await clienteService.checkDocumentExists(
          documento,
          isEditMode ? clienteToEdit?.id : undefined
        );
        console.log('🔍 Resultado de verificación:', result);
        if (result.exists && result.cliente) {
          // El backend devuelve first_name/last_name, no nombre/apellidos
          const cliente = result.cliente as any;
          const nombreCliente = cliente.nombre || cliente.first_name || '';
          const apellidosCliente = cliente.apellidos || cliente.last_name || '';
          const razonSocial = cliente.razon_social || cliente.company || cliente.company_legal_name || '';
          const displayName = razonSocial || `${nombreCliente} ${apellidosCliente}`.trim() || 'Cliente existente';
          setDocumentoError(`Ya existe un cliente con este documento: ${displayName}`);
        } else {
          setDocumentoError(null);
        }
      } catch (e) {
        console.error('Error verificando documento:', e);
        setDocumentoError(null);
      } finally {
        setCheckingDocumento(false);
      }
    }, 500);
    
    return () => {
      if (documentoCheckRef.current) {
        clearTimeout(documentoCheckRef.current);
      }
    };
  }, [formData.cuit, isEditMode, clienteToEdit?.id]);

  // Sincronizar cuando se abre en modo edición desde la modal
  useEffect(() => {
    if (isEditMode && clienteToEdit) {
      setFormData({
        client_type: clienteToEdit.client_type ?? 'persona',
        nombre: clienteToEdit.nombre ?? '',
        apellidos: clienteToEdit.apellidos ?? '',
        cuit: clienteToEdit.cuit ?? '',
        tipo_documento:
          clienteToEdit.tipo_documento ?? (clienteToEdit.client_type === 'empresa' ? 'NIT' : ''),
        fecha_expedicion_documento: normalizeDateToISO(
          (clienteToEdit as any).fecha_expedicion_documento ?? '',
        ),
        fecha_nacimiento: normalizeDateToISO(
          (clienteToEdit as any).fecha_nacimiento ??
            (clienteToEdit as any).persona?.fecha_nacimiento ??
            '',
        ),
        genero: normalizeGeneroToUi(
          ((clienteToEdit as any).genero ?? (clienteToEdit as any).persona?.genero ?? '') as string,
        ),
        domicilio_principal: clienteToEdit.domicilio_principal ?? '',
        celular_principal: clienteToEdit.celular_principal ?? '',
        email_principal: clienteToEdit.email_principal ?? '',
        actividad: clienteToEdit.actividad ?? '',
        ciudad: clienteToEdit.ciudad ?? '',
        department:
          (clienteToEdit as any).department ??
          (clienteToEdit as any).state ??
          (clienteToEdit as any).departamento ??
          '',
        branch_name: (clienteToEdit as any).branch_name ?? (clienteToEdit as any).sede ?? '',
        estado: normalizeEstadoToUi(clienteToEdit.estado ?? 'prospecto'),
        observaciones: clienteToEdit.observaciones ?? '',
        razon_social: clienteToEdit.razon_social ?? '',
        representante_legal: clienteToEdit.representante_legal ?? '',
        representante_legal_tipo_documento: clienteToEdit.representante_legal_tipo_documento ?? '',
        representante_legal_documento: clienteToEdit.representante_legal_documento ?? '',
        etiquetas: (clienteToEdit as any).etiquetas || '',
      });
    }
  }, [isEditMode, clienteToEdit]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      // Ajuste: si cambia el tipo de cliente, autoajustar tipo_documento
      if (name === 'client_type') {
        setFormData((prev) => ({
          ...prev,
          client_type: value as any,
          tipo_documento: value === 'empresa' ? 'NIT' : '',
        }));
        clearError('client_type');
        clearError('tipo_documento');
        return;
      }

      setFormData((prev) => ({ ...prev, [name]: value }));

      if (errors[name as keyof ClienteFormData]) {
        clearError(name);
      }
    },
    [errors, clearError],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent, _forceSubmit: boolean = false) => {
    e.preventDefault();

    // Validar antes de guardar
    if (canSave()) {
      setIsLoading(true);
      try {
        const clienteData: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
          client_type: formData.client_type,
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          cuit: formData.cuit,
          tipo_documento: formData.tipo_documento,
          fecha_expedicion_documento: formData.fecha_expedicion_documento || undefined,
          fecha_nacimiento:
            formData.client_type === 'persona' ? formData.fecha_nacimiento || undefined : undefined,
          genero: formData.client_type === 'persona' ? formData.genero || undefined : undefined,
          domicilio_principal: formData.domicilio_principal,
          celular_principal: formData.celular_principal,
          email_principal: formData.email_principal,
          actividad: formData.actividad || undefined,
          ciudad: formData.ciudad || undefined,
          department: (formData as any).department || undefined,
          branch_name: (formData as any).branch_name || undefined,
          estado: formData.estado,
          observaciones: formData.observaciones || undefined,
          etiquetas: formData.etiquetas || '',
          // Empresa
          razon_social: formData.client_type === 'empresa' ? formData.razon_social : undefined,
          representante_legal:
            formData.client_type === 'empresa' ? formData.representante_legal : undefined,
          representante_legal_tipo_documento:
            formData.client_type === 'empresa'
              ? formData.representante_legal_tipo_documento
              : undefined,
          representante_legal_documento:
            formData.client_type === 'empresa' ? formData.representante_legal_documento : undefined,
        };

        let response;
        if (isEditMode && clienteToEdit?.id) {
          response = await clienteService.updateCliente(clienteToEdit.id, clienteData);
        } else {
          response = await clienteService.createCliente(clienteData);
        }

        if (response.success) {
          // Preferir callback si está definido (uso en modal desde crear póliza)
          if (onSaveSuccess) {
            onSaveSuccess(response.data as any);
          } else {
            // Flujo por defecto (pantalla standalone): resetear y navegar
            setFormData({
              client_type: 'persona',
              nombre: '',
              apellidos: '',
              cuit: '',
              tipo_documento: '',
              fecha_expedicion_documento: '',
              fecha_nacimiento: '',
              genero: '',
              domicilio_principal: '',
              celular_principal: '',
              email_principal: '',
              actividad: '',
              ciudad: '',
              department: '',
              branch_name: '',
              estado: 'prospecto',
              observaciones: '',
              razon_social: '',
              representante_legal: '',
              representante_legal_tipo_documento: '',
              representante_legal_documento: '',
              etiquetas: '',
            });
            navigate('/apps/seguros/clientes');
          }
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>

      {/* Main two-column layout */}
      <div className="grid gap-4 xl:grid-cols-2">

      {/* ==================== LEFT COLUMN ==================== */}
      <div className="space-y-4">

        {/* === TIPO Y DATOS BÁSICOS === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Información básica" icon="solar:user-id-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="client_type" name="client_type" label="Tipo" value={formData.client_type || ''} onChange={handleInputChange} error={(errors as any).client_type} required type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'persona', label: 'Persona' }, { value: 'empresa', label: 'Empresa' },
            ]} />

            <FormField id="tipo_documento" name="tipo_documento" label="Tipo Doc." value={formData.tipo_documento} onChange={handleInputChange} error={errors.tipo_documento} required type="select" options={
              formData.client_type === 'empresa'
                ? [{ value: 'NIT', label: 'NIT' }]
                : [{ value: '', label: 'Seleccionar' }, { value: 'CC', label: 'CC' }, { value: 'CE', label: 'CE' }, { value: 'TI', label: 'TI' }, { value: 'PP', label: 'Pasaporte' }]
            } />

            <div className="relative">
              <FormField id="cuit" name="cuit" label={formData.client_type === 'empresa' ? 'NIT' : 'Documento'} value={formData.cuit} onChange={handleInputChange} error={errors.cuit} required placeholder={formData.client_type === 'empresa' ? 'NIT' : 'Número'} />
              {checkingDocumento && <div className="absolute right-2 top-8"><Spinner size="sm" /></div>}
              {!checkingDocumento && documentoError && !isEditMode && (
                <div className="flex items-center gap-1 mt-0.5 text-amber-600 text-[10px]"><Icon icon="solar:danger-triangle-bold" className="w-3 h-3" /><span>{documentoError}</span></div>
              )}
            </div>

            {formData.client_type !== 'empresa' && (<>
              <FormField id="nombre" name="nombre" label="Nombre" value={formData.nombre} onChange={handleInputChange} error={errors.nombre} required placeholder="Nombre" />
              <FormField id="apellidos" name="apellidos" label="Apellidos" value={formData.apellidos} onChange={handleInputChange} error={errors.apellidos} required placeholder="Apellidos" />
            </>)}

            {formData.client_type === 'empresa' && (<>
              <FormField id="razon_social" name="razon_social" label="Razón Social" value={formData.razon_social || ''} onChange={handleInputChange} error={(errors as any).razon_social} required placeholder="Razón social" />
              <FormField id="representante_legal" name="representante_legal" label="Rep. Legal" value={formData.representante_legal || ''} onChange={handleInputChange} placeholder="Nombre representante" />
              <FormField id="representante_legal_tipo_documento" name="representante_legal_tipo_documento" label="Tipo Doc. Rep." value={formData.representante_legal_tipo_documento || ''} onChange={handleInputChange} type="select" options={[
                { value: '', label: 'Seleccionar' }, { value: 'CC', label: 'CC' }, { value: 'CE', label: 'CE' }, { value: 'PP', label: 'Pasaporte' },
              ]} />
              <FormField id="representante_legal_documento" name="representante_legal_documento" label="Doc. Rep." value={formData.representante_legal_documento || ''} onChange={handleInputChange} placeholder="Número" />
            </>)}

            <FormField id="fecha_expedicion_documento" name="fecha_expedicion_documento" label="Fecha Exp. Doc." type="date" value={(formData as any).fecha_expedicion_documento || ''} onChange={handleInputChange} />

            {formData.client_type !== 'empresa' && (
              <div>
                <Label htmlFor="fecha_nacimiento" className="text-xs font-medium text-gray-900 dark:text-white">Fecha Nac.</Label>
                <Input id="fecha_nacimiento" name="fecha_nacimiento" type="date" value={formData.fecha_nacimiento} onChange={handleInputChange} className={`mt-1 ${errors.fecha_nacimiento ? 'border-red-500' : ''}`} />
                {errors.fecha_nacimiento && <p className="text-red-500 text-[10px] mt-0.5">{errors.fecha_nacimiento}</p>}
              </div>
            )}

            {formData.client_type !== 'empresa' && (
              <FormField id="genero" name="genero" label="Género" value={formData.genero} onChange={handleInputChange} error={errors.genero} required type="select" options={[
                { value: '', label: 'Seleccionar' }, { value: 'masculino', label: 'Masculino' }, { value: 'femenino', label: 'Femenino' }, { value: 'otro', label: 'Otro' },
              ]} />
            )}

            <FormField id="celular_principal" name="celular_principal" label="Celular" type="tel" value={formData.celular_principal} onChange={handleInputChange} error={errors.celular_principal} required placeholder="300 123 4567" />
            <FormField id="email_principal" name="email_principal" label="Email" type="email" value={formData.email_principal} onChange={handleInputChange} error={errors.email_principal} required placeholder="cliente@dominio.com" />
          </div>
        </div>

        {/* === ETIQUETAS === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Etiquetas" icon="solar:tag-bold-duotone" />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                id="nueva_etiqueta"
                placeholder="Escribe y presiona Enter..."
                className="pr-10 text-sm"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation();
                    const input = e.currentTarget;
                    const value = input.value.trim().toLowerCase().replace(/\s+/g, '_');
                    if (value && value.length >= 2) {
                      const currentTags = (formData.etiquetas || '').split(',').filter(Boolean);
                      if (!currentTags.includes(value)) setFormData(prev => ({ ...prev, etiquetas: [...currentTags, value].join(',') }));
                      input.value = '';
                    }
                  }
                }}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary" onClick={() => {
                const input = document.getElementById('nueva_etiqueta') as HTMLInputElement;
                const value = input?.value.trim().toLowerCase().replace(/\s+/g, '_');
                if (value && value.length >= 2) {
                  const currentTags = (formData.etiquetas || '').split(',').filter(Boolean);
                  if (!currentTags.includes(value)) setFormData(prev => ({ ...prev, etiquetas: [...currentTags, value].join(',') }));
                  input.value = '';
                }
              }}>
                <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
              </button>
            </div>
          </div>
          {(() => {
            const allTags = (formData.etiquetas || '').split(',').filter(Boolean);
            if (allTags.length === 0) return null;
            return (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    {tag.replace(/_/g, ' ')}
                    <button type="button" onClick={() => { const newTags = allTags.filter(t => t !== tag); setFormData(prev => ({ ...prev, etiquetas: newTags.join(',') })); }} className="ml-0.5 text-primary/60 hover:text-red-500">
                      <Icon icon="solar:close-circle-bold" className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            );
          })()}
        </div>

      </div>{/* END LEFT COLUMN */}

      {/* ==================== RIGHT COLUMN ==================== */}
      <div className="space-y-4">

        {/* === CONTACTO Y UBICACIÓN === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Contacto y ubicación" icon="solar:map-point-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="col-span-2">
              <FormField id="domicilio_principal" name="domicilio_principal" label="Domicilio" value={formData.domicilio_principal} onChange={handleInputChange} error={errors.domicilio_principal} required placeholder="Dirección completa" />
            </div>
            <FormField id="ciudad" name="ciudad" label="Ciudad" value={formData.ciudad} onChange={handleInputChange} error={errors.ciudad} required placeholder="Ciudad" />
            <FormField id="department" name="department" label="Departamento" value={(formData as any).department || ''} onChange={handleInputChange} error={(errors as any).department} required placeholder="Departamento" />
            <FormField id="actividad" name="actividad" label="Actividad" value={formData.actividad} onChange={handleInputChange} placeholder="Actividad económica" />
            <FormField id="branch_name" name="branch_name" label="Sede" value={(formData as any).branch_name || ''} onChange={handleInputChange} placeholder="Sede" />
          </div>
        </div>

        {/* === ESTADO Y OBSERVACIONES === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Estado" icon="solar:shield-check-bold" />
          <div className="grid grid-cols-2 gap-3">
            <FormField id="estado" name="estado" label="Estado" value={formData.estado} onChange={handleInputChange} error={errors.estado} required type="select" options={[
              { value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }, { value: 'prospecto', label: 'Prospecto' },
            ]} />
          </div>
          <div className="mt-3">
            <Label htmlFor="observaciones" className="text-xs font-medium text-gray-900 dark:text-white">Observaciones</Label>
            <Textarea id="observaciones" name="observaciones" value={formData.observaciones} onChange={handleInputChange} placeholder="Observaciones adicionales" rows={2} className="mt-1" />
          </div>
        </div>

      </div>{/* END RIGHT COLUMN */}

      </div>{/* END GRID */}

      {/* === BOTÓN GUARDAR FIJO === */}
      <div className="sticky bottom-0 z-50 mt-4 p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 rounded-b-lg flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {isEditMode ? `Editando: ${formData.nombre} ${formData.apellidos}`.trim() : 'Nuevo cliente'}
        </div>
        <Button type="button" color="success" disabled={isLoading || !canSave()} onClick={(e) => handleSubmit(e as any, true)} className="flex items-center gap-2 px-6 py-2 rounded-lg" title={!canSave() ? 'Complete los campos obligatorios' : ''}>
          {isLoading ? (<><Spinner size="sm" /><span>Guardando...</span></>) : (<><Icon icon="solar:diskette-bold" className="w-4 h-4" /><span>{isEditMode ? 'Actualizar' : 'Crear'} Cliente</span></>)}
        </Button>
      </div>

      </form>
    </>
  );
};

export default NuevoCliente;

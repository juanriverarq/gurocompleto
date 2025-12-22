import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Textarea, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import TitleCard from 'src/components/shared/TitleBorderCard';
import CardBox from 'src/components/shared/CardBox';
import FormField from 'src/components/shared/FormField';
import { clienteService, Cliente } from 'src/services/clienteService';
import {} from 'src/hooks/use-toast';
import useClienteValidation, { ClienteFormData } from 'src/hooks/useClienteValidation';

interface StepperProps {
  currentStep: number;
  steps: { title: string; description: string }[];
  onStepClick: (step: number) => void;
}

const Stepper: React.FC<StepperProps> = ({ currentStep, steps, onStepClick }) => {
  return (
    <div className="flex items-center justify-center w-full mb-4">
      <div className="flex items-center space-x-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className="flex flex-col items-center">
              <button
                onClick={() => onStepClick(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                  index <= currentStep
                    ? 'bg-primary text-white shadow-lg transform scale-110'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                {index < currentStep ? (
                  <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </button>
              <div className="text-center mt-2">
                <p
                  className={`text-xs font-medium leading-tight ${
                    index <= currentStep ? 'text-primary' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-gray-400 leading-tight">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-3 ${index < currentStep ? 'bg-primary' : 'bg-gray-300'}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

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
    estado: normalizeEstadoToUi(clienteToEdit?.estado || 'prospecto'),
    observaciones: clienteToEdit?.observaciones || '',
    razon_social: '',
    representante_legal: '',
    representante_legal_tipo_documento: '',
    representante_legal_documento: '',
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { errors, validateStepAndSetErrors, clearError } = useClienteValidation();
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

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
      });
      setCurrentStep(0);
    }
  }, [isEditMode, clienteToEdit]);

  const steps = [
    { title: 'Tipo y Básicos', description: 'Persona o empresa y datos base' },
    { title: 'Contacto y Ubicación', description: 'Información de contacto' },
  ];

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
        if (currentStep < steps.length - 1) {
          nextStep();
        } else {
          if (formRef.current) {
            formRef.current.requestSubmit();
          }
        }
      }
    },
    [currentStep, steps.length],
  );

  const validateStep = (step: number): boolean => {
    return validateStepAndSetErrors(step, formData);
  };

  const nextStep = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (step: number) => {
    if (step <= currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < steps.length - 1) {
      nextStep();
      return;
    }

    if (validateStep(currentStep)) {
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
            });
            setCurrentStep(0);
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
      <div className="grid gap-4">
        <div className="col-span-12">
          <CardBox className="mb-4">
            <Stepper currentStep={currentStep} steps={steps} onStepClick={handleStepClick} />
          </CardBox>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            className="space-y-4"
          >
            <div>
              {/* Paso 1: Información Personal */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <TitleCard title="Tipo y Básicos">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        id="client_type"
                        name="client_type"
                        label="Tipo de Cliente"
                        value={formData.client_type || ''}
                        onChange={handleInputChange}
                        error={(errors as any).client_type}
                        required
                        type="select"
                        options={[
                          { value: '', label: 'Seleccionar tipo' },
                          { value: 'persona', label: 'Persona' },
                          { value: 'empresa', label: 'Empresa' },
                        ]}
                      />

                      {formData.client_type !== 'empresa' && (
                        <>
                          <FormField
                            id="nombre"
                            name="nombre"
                            label="Nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            error={errors.nombre}
                            required
                            placeholder="Nombre del cliente"
                          />

                          <FormField
                            id="apellidos"
                            name="apellidos"
                            label="Apellidos"
                            value={formData.apellidos}
                            onChange={handleInputChange}
                            error={errors.apellidos}
                            required
                            placeholder="Apellidos del cliente"
                          />
                        </>
                      )}

                      {formData.client_type === 'empresa' && (
                        <>
                          <FormField
                            id="razon_social"
                            name="razon_social"
                            label="Razón Social"
                            value={formData.razon_social || ''}
                            onChange={handleInputChange}
                            error={(errors as any).razon_social}
                            required
                            placeholder="Razón social de la empresa"
                          />
                          <FormField
                            id="representante_legal"
                            name="representante_legal"
                            label="Representante Legal (Nombre)"
                            value={formData.representante_legal || ''}
                            onChange={handleInputChange}
                            error={(errors as any).representante_legal}
                            placeholder="Nombre del representante legal"
                          />
                          <FormField
                            id="representante_legal_tipo_documento"
                            name="representante_legal_tipo_documento"
                            label="Tipo de Documento Representante"
                            value={formData.representante_legal_tipo_documento || ''}
                            onChange={handleInputChange}
                            error={(errors as any).representante_legal_tipo_documento}
                            type="select"
                            options={[
                              { value: '', label: 'Seleccionar tipo' },
                              { value: 'CC', label: 'Cédula de Ciudadanía' },
                              { value: 'CE', label: 'Cédula de Extranjería' },
                              { value: 'PP', label: 'Pasaporte' },
                            ]}
                          />
                          <FormField
                            id="representante_legal_documento"
                            name="representante_legal_documento"
                            label="Documento Representante"
                            value={formData.representante_legal_documento || ''}
                            onChange={handleInputChange}
                            error={(errors as any).representante_legal_documento}
                            placeholder="Número de documento del representante"
                          />
                        </>
                      )}

                      {/* Tipo de documento primero, luego número */}
                      <FormField
                        id="tipo_documento"
                        name="tipo_documento"
                        label="Tipo de Documento"
                        value={formData.tipo_documento}
                        onChange={handleInputChange}
                        error={errors.tipo_documento}
                        required
                        type="select"
                        options={
                          formData.client_type === 'empresa'
                            ? [{ value: 'NIT', label: 'NIT' }]
                            : [
                                { value: '', label: 'Seleccionar tipo' },
                                { value: 'CC', label: 'Cédula de Ciudadanía' },
                                { value: 'CE', label: 'Cédula de Extranjería' },
                                { value: 'TI', label: 'Tarjeta de Identidad' },
                                { value: 'PP', label: 'Pasaporte' },
                              ]
                        }
                      />

                      <FormField
                        id="cuit"
                        name="cuit"
                        label={formData.client_type === 'empresa' ? 'NIT' : 'Número de documento'}
                        value={formData.cuit}
                        onChange={handleInputChange}
                        error={errors.cuit}
                        required
                        placeholder={
                          formData.client_type === 'empresa' ? 'NIT' : 'Número de documento'
                        }
                        helperText="Solo números, 6-15 dígitos"
                      />

                      <div>
                        <Label
                          htmlFor="fecha_expedicion_documento"
                          className="text-sm font-medium text-gray-900 dark:text-white"
                        >
                          Fecha de Expedición del Documento
                        </Label>
                        <Input
                          id="fecha_expedicion_documento"
                          name="fecha_expedicion_documento"
                          type="date"
                          value={(formData as any).fecha_expedicion_documento || ''}
                          onChange={handleInputChange}
                          className="mt-1"
                          placeholder="Fecha de expedición"
                        />
                      </div>

                      {formData.client_type !== 'empresa' && (
                        <div>
                          <Label
                            htmlFor="fecha_nacimiento"
                            className="text-sm font-medium text-gray-900 dark:text-white"
                          >
                            Fecha de Nacimiento
                          </Label>
                          <Input
                            id="fecha_nacimiento"
                            name="fecha_nacimiento"
                            type="date"
                            value={formData.fecha_nacimiento}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.fecha_nacimiento ? 'border-red-500' : ''}`}
                          />
                          {errors.fecha_nacimiento && (
                            <p className="text-red-500 text-xs mt-1">{errors.fecha_nacimiento}</p>
                          )}
                        </div>
                      )}

                      {formData.client_type !== 'empresa' && (
                        <FormField
                          id="genero"
                          name="genero"
                          label="Género"
                          value={formData.genero}
                          onChange={handleInputChange}
                          error={errors.genero}
                          required
                          type="select"
                          options={[
                            { value: '', label: 'Seleccionar género' },
                            { value: 'masculino', label: 'Masculino' },
                            { value: 'femenino', label: 'Femenino' },
                            { value: 'otro', label: 'Otro' },
                          ]}
                        />
                      )}

                      <FormField
                        id="celular_principal"
                        name="celular_principal"
                        label="Celular"
                        type="tel"
                        value={formData.celular_principal}
                        onChange={handleInputChange}
                        error={errors.celular_principal}
                        required
                        placeholder="300 123 4567"
                        helperText="Formato: 300 123 4567"
                      />

                      <FormField
                        id="email_principal"
                        name="email_principal"
                        label="Email"
                        type="email"
                        value={formData.email_principal}
                        onChange={handleInputChange}
                        error={errors.email_principal}
                        required
                        placeholder="cliente@dominio.com"
                        helperText="Formato: usuario@dominio.com"
                      />
                    </div>
                  </TitleCard>
                </div>
              )}

              {/* Paso 2: Contacto y Ubicación */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <TitleCard title="Contacto y Ubicación">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        id="domicilio_principal"
                        name="domicilio_principal"
                        label="Domicilio"
                        value={formData.domicilio_principal}
                        onChange={handleInputChange}
                        error={errors.domicilio_principal}
                        required
                        placeholder="Dirección completa"
                      />

                      <FormField
                        id="ciudad"
                        name="ciudad"
                        label="Ciudad"
                        value={formData.ciudad}
                        onChange={handleInputChange}
                        error={errors.ciudad}
                        required
                        placeholder="Ciudad de residencia"
                      />

                      <FormField
                        id="department"
                        name="department"
                        label="Departamento"
                        value={(formData as any).department || ''}
                        onChange={handleInputChange}
                        error={(errors as any).department}
                        required
                        placeholder="Departamento (estado)"
                      />

                      <div>
                        <Label
                          htmlFor="actividad"
                          className="text-sm font-medium text-gray-900 dark:text-white"
                        >
                          Actividad
                        </Label>
                        <Input
                          id="actividad"
                          name="actividad"
                          value={formData.actividad}
                          onChange={handleInputChange}
                          placeholder="Actividad económica"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor="branch_name"
                          className="text-sm font-medium text-gray-900 dark:text-white"
                        >
                          Sede
                        </Label>
                        <Input
                          id="branch_name"
                          name="branch_name"
                          value={(formData as any).branch_name || ''}
                          onChange={handleInputChange}
                          placeholder="Sede de atención"
                          className="mt-1"
                        />
                      </div>

                      <FormField
                        id="estado"
                        name="estado"
                        label="Estado"
                        value={formData.estado}
                        onChange={handleInputChange}
                        error={errors.estado}
                        required
                        type="select"
                        options={[
                          { value: 'activo', label: 'Activo' },
                          { value: 'inactivo', label: 'Inactivo' },
                          { value: 'prospecto', label: 'Prospecto' },
                        ]}
                      />
                    </div>

                    <div className="mt-4">
                      <Label
                        htmlFor="observaciones"
                        className="text-sm font-medium text-gray-900 dark:text-white"
                      >
                        Observaciones
                      </Label>
                      <Textarea
                        id="observaciones"
                        name="observaciones"
                        value={formData.observaciones}
                        onChange={handleInputChange}
                        placeholder="Observaciones adicionales del cliente"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                  </TitleCard>
                </div>
              )}
            </div>

            {/* Botones de Navegación */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2 order-2 sm:order-1">
                <Button
                  type="button"
                  color="light"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                >
                  <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
                  <span>Anterior</span>
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    color="primary"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                  >
                    <span>Siguiente</span>
                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:diskette-bold" className="w-4 h-4" />
                        <span>{isEditMode ? 'Actualizar' : 'Crear'} Cliente</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Indicador de progreso */}
              <div className="flex items-center gap-2 text-sm text-gray-500 order-1 sm:order-2">
                <span>
                  Paso {currentStep + 1} de {steps.length}
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default NuevoCliente;

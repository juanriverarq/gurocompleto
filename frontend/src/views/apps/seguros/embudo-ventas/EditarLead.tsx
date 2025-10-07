import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from "@iconify/react";
import { Card, Button, TextInput, Textarea, Spinner, Alert, Select } from 'flowbite-react';

import {
  salesFunnelService,
  UpdateLeadData,
  SalesFunnelLead,
  Agent,
  STAGES,
  INSURANCE_TYPES,
  LEAD_SOURCES,
  QUALITY_RATINGS,
  CONTACT_METHODS,
  CONTACT_TIMES,
  COMPANY_SIZES
} from '../../../../services/salesFunnelService';

const EditarLead: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Estados
  const [formData, setFormData] = useState<UpdateLeadData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  // Validación
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadLead();
    loadAgents();
  }, [id]);

  const loadLead = async () => {
    try {
      const leadData = await salesFunnelService.getLead(Number(id));
      setFormData(leadData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el lead');
      setFormData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const agentsData = await salesFunnelService.getAvailableAgents();
      setAgents(agentsData);
    } catch (err) {
    }
  };

  const handleInputChange = (field: keyof UpdateLeadData, value: any) => {
    if (formData) {
      setFormData(prev => ({ ...prev!, [field]: value }));
      
      // Limpiar error de validación si existe
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validaciones requeridas
    if (!formData?.first_name?.trim()) {
      errors.first_name = 'El nombre es requerido';
    }

    if (!formData?.last_name?.trim()) {
      errors.last_name = 'El apellido es requerido';
    }

    if (!formData?.email && !formData?.phone) {
      errors.email = 'Se requiere al menos email o teléfono';
      errors.phone = 'Se requiere al menos email o teléfono';
    }

    // Validar email si se proporciona
    if (formData?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'El email no tiene un formato válido';
    }

    // Validar teléfono si se proporciona
    if (formData?.phone && !/^[\d\s\+\-\(\)]+$/.test(formData.phone)) {
      errors.phone = 'El teléfono no tiene un formato válido';
    }

    // Validar valor potencial
    if (formData?.potential_value <= 0) {
      errors.potential_value = 'El valor potencial debe ser mayor a 0';
    }

    // Validar probabilidad de cierre
    if (formData?.close_probability < 0 || formData?.close_probability > 100) {
      errors.close_probability = 'La probabilidad debe estar entre 0 y 100';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Por favor corrige los errores en el formulario');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Preparar datos para envío
      const dataToSend = {
        ...formData,
        // Asegurarse de que los campos numéricos sean números
        potential_value: Number(formData?.potential_value),
        close_probability: Number(formData?.close_probability),
        lead_score: Number(formData?.lead_score),
        assigned_agent_id: formData?.assigned_agent_id || undefined,
        // Limpiar campos vacíos
        email: formData?.email?.trim() || undefined,
        phone: formData?.phone?.trim() || undefined,
        secondary_phone: formData?.secondary_phone?.trim() || undefined,
        document_number: formData?.document_number?.trim() || undefined,
        company_name: formData?.company_name?.trim() || undefined,
        company_size: formData?.company_size || undefined,
        industry: formData?.industry?.trim() || undefined,
        position: formData?.position?.trim() || undefined,
        city: formData?.city?.trim() || undefined,
        department: formData?.department?.trim() || undefined,
        address: formData?.address?.trim() || undefined,
        expected_close_date: formData?.expected_close_date || undefined,
        preferred_contact_time: formData?.preferred_contact_time || undefined,
        next_follow_up_at: formData?.next_follow_up_at || undefined,
        notes: formData?.notes?.trim() || undefined
      };

      const response = await salesFunnelService.updateLead(Number(id), dataToSend);
      navigate('/apps/seguros/embudo-ventas');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el lead');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadLead();
    setValidationErrors({});
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-2 text-lg">Cargando lead...</span>
      </div>
    );
  }

  

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/apps/seguros/embudo-ventas')}
            color="gray"
            className="p-2"
          >
            <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Editar Lead
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Actualiza la información del prospecto
            </p>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Personal */}
        <Card>
          <div className="space-y-6">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:user-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Información Personal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <TextInput
                  value={formData?.first_name || ''}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Nombre del prospecto"
                  color={validationErrors.first_name ? 'failure' : undefined}
                  helperText={validationErrors.first_name}
                  required
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Apellido *
                </label>
                <TextInput
                  value={formData?.last_name || ''}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Apellido del prospecto"
                  color={validationErrors.last_name ? 'failure' : undefined}
                  helperText={validationErrors.last_name}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <TextInput
                  type="email"
                  value={formData?.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="email@ejemplo.com"
                  color={validationErrors.email ? 'failure' : undefined}
                  helperText={validationErrors.email}
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono
                </label>
                <TextInput
                  value={formData?.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+57 300 123 4567"
                  color={validationErrors.phone ? 'failure' : undefined}
                  helperText={validationErrors.phone}
                />
              </div>

              {/* Teléfono Secundario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono Secundario
                </label>
                <TextInput
                  value={formData?.secondary_phone || ''}
                  onChange={(e) => handleInputChange('secondary_phone', e.target.value)}
                  placeholder="+57 301 123 4567"
                />
              </div>

              {/* Tipo de Documento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={formData?.document_type || ''}
                  onChange={(e) => handleInputChange('document_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="cc">Cédula de Ciudadanía</option>
                  <option value="ce">Cédula de Extranjería</option>
                  <option value="ti">Tarjeta de Identidad</option>
                  <option value="pp">Pasaporte</option>
                  <option value="nit">NIT</option>
                </select>
              </div>

              {/* Número de Documento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número de Documento
                </label>
                <TextInput
                  value={formData?.document_number || ''}
                  onChange={(e) => handleInputChange('document_number', e.target.value)}
                  placeholder="1234567890"
                />
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ciudad
                </label>
                <TextInput
                  value={formData?.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Bogotá"
                />
              </div>

              {/* Departamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Departamento
                </label>
                <TextInput
                  value={formData?.department || ''}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="Cundinamarca"
                />
              </div>

              {/* Dirección */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dirección
                </label>
                <TextInput
                  value={formData?.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Calle 123 #45-67"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Información Empresarial */}
        <Card>
          <div className="space-y-6">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:buildings-2-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Información Empresarial (Opcional)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre de la Empresa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre de la Empresa
                </label>
                <TextInput
                  value={formData?.company_name || ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Empresa S.A.S."
                />
              </div>

              {/* Tamaño de la Empresa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tamaño de la Empresa
                </label>
                <select
                  value={formData?.company_size || ''}
                  onChange={(e) => handleInputChange('company_size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="">Seleccionar tamaño</option>
                  {Object.entries(COMPANY_SIZES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Industria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Industria
                </label>
                <TextInput
                  value={formData?.industry || ''}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  placeholder="Tecnología"
                />
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cargo
                </label>
                <TextInput
                  value={formData?.position || ''}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="Gerente General"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Información del Lead */}
        <Card>
          <div className="space-y-6">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:target-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Información del Lead
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Etapa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Etapa
                </label>
                <select
                  value={formData?.stage || ''}
                  onChange={(e) => handleInputChange('stage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(STAGES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Fuente del Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fuente del Lead
                </label>
                <select
                  value={formData?.lead_source || ''}
                  onChange={(e) => handleInputChange('lead_source', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(LEAD_SOURCES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Calidad del Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Calidad del Lead
                </label>
                <select
                  value={formData?.quality_rating || ''}
                  onChange={(e) => handleInputChange('quality_rating', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(QUALITY_RATINGS).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Agente Asignado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agente Asignado
                </label>
                <select
                  value={formData?.assigned_agent_id || ''}
                  onChange={(e) => handleInputChange('assigned_agent_id', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sin asignar</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Puntuación del Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Puntuación del Lead (0-100)
                </label>
                <TextInput
                  type="number"
                  min="0"
                  max="100"
                  value={formData?.lead_score || 0}
                  onChange={(e) => handleInputChange('lead_score', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Información del Seguro */}
        <Card>
          <div className="space-y-6">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Información del Seguro
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Seguro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Seguro *
                </label>
                <select
                  value={formData?.insurance_type || ''}
                  onChange={(e) => handleInputChange('insurance_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(INSURANCE_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Valor Potencial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor Potencial (COP) *
                </label>
                <TextInput
                  type="number"
                  min="0"
                  value={formData?.potential_value || 0}
                  onChange={(e) => handleInputChange('potential_value', Number(e.target.value))}
                  placeholder="1000000"
                  color={validationErrors.potential_value ? 'failure' : undefined}
                  helperText={validationErrors.potential_value}
                  required
                />
              </div>

              {/* Probabilidad de Cierre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Probabilidad de Cierre (%) *
                </label>
                <TextInput
                  type="number"
                  min="0"
                  max="100"
                  value={formData?.close_probability || 0}
                  onChange={(e) => handleInputChange('close_probability', Number(e.target.value))}
                  color={validationErrors.close_probability ? 'failure' : undefined}
                  helperText={validationErrors.close_probability}
                  required
                />
              </div>

              {/* Fecha Esperada de Cierre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha Esperada de Cierre
                </label>
                <TextInput
                  type="date"
                  value={formData?.expected_close_date || ''}
                  onChange={(e) => handleInputChange('expected_close_date', e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Preferencias de Contacto */}
        <Card>
          <div className="space-y-6">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Preferencias de Contacto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Método Preferido de Contacto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Método Preferido de Contacto
                </label>
                <select
                  value={formData?.preferred_contact_method || ''}
                  onChange={(e) => handleInputChange('preferred_contact_method', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(CONTACT_METHODS).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Horario Preferido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horario Preferido
                </label>
                <select
                  value={formData?.preferred_contact_time || ''}
                  onChange={(e) => handleInputChange('preferred_contact_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sin preferencia</option>
                  {Object.entries(CONTACT_TIMES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              {/* Próximo Seguimiento */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Próximo Seguimiento
                </label>
                <TextInput
                  type="datetime-local"
                  value={formData?.next_follow_up_at || ''}
                  onChange={(e) => handleInputChange('next_follow_up_at', e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Notas */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Notas Adicionales
            </h3>

            <Textarea
              value={formData?.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Información adicional sobre el prospecto..."
              rows={4}
            />
          </div>
        </Card>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-4 pt-6">
          <Button
            type="button"
            color="gray"
            onClick={handleReset}
            disabled={saving}
          >
            Resetear Formulario
          </Button>

          <Button
            type="button"
            color="light"
            onClick={() => navigate('/apps/seguros/embudo-ventas')}
            disabled={saving}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Guardando cambios...
              </>
            ) : (
              <>
                <Icon icon="solar:check-bold-duotone" className="w-4 h-4 mr-2" />
                Actualizar Lead
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditarLead;


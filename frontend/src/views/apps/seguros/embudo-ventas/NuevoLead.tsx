import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from "@iconify/react";
import { Card, Button, TextInput, Textarea, Spinner, Alert, Select } from 'flowbite-react';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';
import { useRamos, useVendedores } from 'src/hooks/useAdminCrudApi';

import {
  salesFunnelService,
  CreateLeadData,
  Agent,
  STAGES,
  INSURANCE_TYPES,
  LEAD_SOURCES,
  QUALITY_RATINGS,
  CONTACT_METHODS,
  CONTACT_TIMES,
  COMPANY_SIZES
} from '../../../../services/salesFunnelService';

const NuevoLead: React.FC = () => {
  const navigate = useNavigate();

  // Estados
  const [formData, setFormData] = useState<CreateLeadData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    secondary_phone: '',
    document_type: 'cc',
    document_number: '',
    company_name: '',
    company_size: '',
    industry: '',
    position: '',
    city: '',
    department: '',
    address: '',
    stage: 'lead',
    lead_source: 'website',
    insurance_type: 'auto',
    potential_value: 0,
    close_probability: 10,
    expected_close_date: '',
    assigned_agent_id: undefined,
    preferred_contact_method: 'phone',
    preferred_contact_time: '',
    notes: '',
    insurance_details: {},
    custom_fields: {},
    quality_rating: 'warm',
    lead_score: 50,
    next_follow_up_at: ''
  });

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRamo, setSelectedRamo] = useState<string>('');
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');
  const { ramos: ramosHook } = useRamos();
  const { vendedores: vendedoresHook } = useVendedores();

  // Validación
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const agentsData = await salesFunnelService.getAvailableAgents();
      setAgents(agentsData);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateLeadData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error de validación si existe
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validaciones requeridas
    if (!formData.first_name.trim()) {
      errors.first_name = 'El nombre es requerido';
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'El apellido es requerido';
    }

    if (!formData.email && !formData.phone) {
      errors.email = 'Se requiere al menos email o teléfono';
      errors.phone = 'Se requiere al menos email o teléfono';
    }

    // Validar email si se proporciona
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'El email no tiene un formato válido';
    }

    // Validar teléfono si se proporciona
    if (formData.phone && !/^[\d\s\+\-\(\)]+$/.test(formData.phone)) {
      errors.phone = 'El teléfono no tiene un formato válido';
    }

    // Validar valor potencial
    if (formData.potential_value <= 0) {
      errors.potential_value = 'El valor potencial debe ser mayor a 0';
    }

    // Validar probabilidad de cierre
    if (formData.close_probability < 0 || formData.close_probability > 100) {
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
      const mapRamoToInsuranceType = (ramo: string): string => {
        const src = (ramo || '').toLowerCase();
        if (src.includes('auto') || src.includes('veh')) return 'auto';
        if (src.includes('hogar') || src.includes('home')) return 'home';
        if (src.includes('vida') || src.includes('life')) return 'life';
        if (src.includes('salud') || src.includes('health')) return 'health';
        if (src.includes('empres') || src.includes('pym') || src.includes('comer')) return 'business';
        if (src.includes('viaje')) return 'travel';
        if (src.includes('moto')) return 'motorcycle';
        if (src.includes('bici')) return 'bicycle';
        if (src.includes('mascota') || src.includes('pet')) return 'pet';
        return 'multiple';
      };
      const normalizedInsuranceType = selectedRamo ? mapRamoToInsuranceType(selectedRamo) : formData.insurance_type;

      const dataToSend = {
        ...formData,
        insurance_type: normalizedInsuranceType,
        // Asegurarse de que los campos numéricos sean números
        potential_value: Number(formData.potential_value),
        close_probability: Number(formData.close_probability),
        lead_score: Number(formData.lead_score),
        assigned_agent_id: selectedVendedorId ? Number(selectedVendedorId) : (formData.assigned_agent_id || undefined),
        // Limpiar campos vacíos
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        secondary_phone: formData.secondary_phone?.trim() || undefined,
        document_number: formData.document_number?.trim() || undefined,
        company_name: formData.company_name?.trim() || undefined,
        company_size: formData.company_size || undefined,
        industry: formData.industry?.trim() || undefined,
        position: formData.position?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        department: formData.department?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        expected_close_date: formData.expected_close_date || undefined,
        preferred_contact_time: formData.preferred_contact_time || undefined,
        next_follow_up_at: formData.next_follow_up_at || undefined,
        notes: formData.notes?.trim() || undefined
      };

      const response = await salesFunnelService.createLead(dataToSend);
      navigate('/apps/seguros/embudo-ventas');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el lead');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      secondary_phone: '',
      document_type: 'cc',
      document_number: '',
      company_name: '',
      company_size: '',
      industry: '',
      position: '',
      city: '',
      department: '',
      address: '',
      stage: 'lead',
      lead_source: 'website',
      insurance_type: 'auto',
      potential_value: 0,
      close_probability: 10,
      expected_close_date: '',
      assigned_agent_id: undefined,
      preferred_contact_method: 'phone',
      preferred_contact_time: '',
      notes: '',
      insurance_details: {},
      custom_fields: {},
      quality_rating: 'warm',
      lead_score: 50,
      next_follow_up_at: ''
    });
    setValidationErrors({});
    setError(null);
  };

  

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/apps/seguros/embudo-ventas')} color="gray" className="p-2">
            <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Nuevo Lead</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Formulario simplificado</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TitleCard title="Datos del lead">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="first_name"
              name="first_name"
              label="Nombre"
                  value={formData.first_name}
              onChange={(e: any) => handleInputChange('first_name', e.target ? e.target.value : e)}
              error={validationErrors.first_name}
              required
                  placeholder="Nombre del prospecto"
            />
            <FormField
              id="last_name"
              name="last_name"
              label="Apellido"
                  value={formData.last_name}
              onChange={(e: any) => handleInputChange('last_name', e.target ? e.target.value : e)}
              error={validationErrors.last_name}
              required
                  placeholder="Apellido del prospecto"
            />
            <FormField
              id="email"
              name="email"
              label="Email"
                  type="email"
                  value={formData.email}
              onChange={(e: any) => handleInputChange('email', e.target ? e.target.value : e)}
              error={validationErrors.email}
                  placeholder="email@ejemplo.com"
            />
            <FormField
              id="phone"
              name="phone"
              label="Teléfono"
                  value={formData.phone}
              onChange={(e: any) => handleInputChange('phone', e.target ? e.target.value : e)}
              error={validationErrors.phone}
                  placeholder="+57 300 123 4567"
            />
          </div>
        </TitleCard>

        <TitleCard title="Detalles">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="ramo"
              name="ramo"
              label="Ramo"
              value={selectedRamo}
              onChange={(e: any) => setSelectedRamo(e?.target ? e.target.value : e)}
              type="select"
              options={[{ value: '', label: 'Seleccionar ramo' }, ...((ramosHook || []).map((r: any) => ({ value: r.nombre || r.name, label: r.nombre || r.name })))]}
            />
            <FormField
              id="insurance_type"
              name="insurance_type"
              label="Tipo de seguro"
              value={formData.insurance_type}
              onChange={(e: any) => handleInputChange('insurance_type', e.target ? e.target.value : e)}
              type="select"
              options={Object.entries(INSURANCE_TYPES).map(([value, label]) => ({ value, label }))}
              required
            />
            <FormField
              id="potential_value"
              name="potential_value"
              label="Valor potencial (COP)"
                  type="number"
              value={formData.potential_value as any}
              onChange={(e: any) => handleInputChange('potential_value', Number(e.target ? e.target.value : e))}
              error={validationErrors.potential_value}
              required
            />
            <FormField
              id="close_probability"
              name="close_probability"
              label="Probabilidad de cierre (%)"
                  type="number"
              value={formData.close_probability as any}
              onChange={(e: any) => handleInputChange('close_probability', Number(e.target ? e.target.value : e))}
              error={validationErrors.close_probability}
                  required
                />
            <FormField
              id="lead_source"
              name="lead_source"
              label="Fuente del lead"
              value={formData.lead_source}
              onChange={(e: any) => handleInputChange('lead_source', e.target ? e.target.value : e)}
              type="select"
              options={Object.entries(LEAD_SOURCES).map(([value, label]) => ({ value, label }))}
                  required
                />
            <FormField
              id="vendedor_user_id"
              name="vendedor_user_id"
              label="Vendedor / Asesor"
              value={selectedVendedorId}
              onChange={(e: any) => setSelectedVendedorId(e?.target ? e.target.value : e)}
              type="select"
              options={[{ value: '', label: 'Seleccionar vendedor' }, ...((vendedoresHook || []).map((u: any) => ({ value: String(u.id), label: u.nombres || u.nombre || u.name })))]}
            />
            <FormField
              id="preferred_contact_method"
              name="preferred_contact_method"
              label="Método de contacto"
                  value={formData.preferred_contact_method}
              onChange={(e: any) => handleInputChange('preferred_contact_method', e.target ? e.target.value : e)}
              type="select"
              options={Object.entries(CONTACT_METHODS).map(([value, label]) => ({ value, label }))}
              required
            />
            <FormField
              id="quality_rating"
              name="quality_rating"
              label="Calidad del lead"
              value={formData.quality_rating}
              onChange={(e: any) => handleInputChange('quality_rating', e.target ? e.target.value : e)}
              type="select"
              options={Object.entries(QUALITY_RATINGS).map(([value, label]) => ({ value, label }))}
              required
            />
          </div>
        </TitleCard>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" color="light" onClick={() => navigate('/apps/seguros/embudo-ventas')} disabled={saving}>Cancelar</Button>
          <Button type="button" color="gray" onClick={handleReset} disabled={saving}>Limpiar</Button>
          <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? (<><Spinner size="sm" className="mr-2" />Creando...</>) : (<><Icon icon="solar:user-plus-bold-duotone" className="w-4 h-4 mr-2" />Crear lead</>)}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NuevoLead;

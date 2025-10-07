import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Alert, Modal } from 'flowbite-react';
import { Icon as IconifyIcon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';
import { saasApi } from 'src/services/saasApi';
import salesFunnelService, { UpdateLeadData, SalesFunnelLead, STAGES, INSURANCE_TYPES, LEAD_SOURCES, QUALITY_RATINGS } from 'src/services/salesFunnelService';

// Estados dinámicos del negocio
const BUSINESS_STATES = {
  'nuevo': { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: 'solar:star-bold-duotone' },
  'contactado': { label: 'Contactado', color: 'bg-green-100 text-green-800', icon: 'solar:phone-bold-duotone' },
  'interesado': { label: 'Interesado', color: 'bg-orange-100 text-orange-800', icon: 'solar:heart-bold-duotone' },
  'negociando': { label: 'Negociando', color: 'bg-purple-100 text-purple-800', icon: 'solar:handshake-bold-duotone' },
  'cerrado': { label: 'Cerrado', color: 'bg-gray-100 text-gray-800', icon: 'solar:check-circle-bold-duotone' }
};

const EditarLead: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<SalesFunnelLead | null>(null);
  const [form, setForm] = useState<UpdateLeadData>({});

  // Estados para selección de cliente
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ 
    id?: string; 
    nombre?: string; 
    documento?: string; 
    celular?: string; 
    email?: string; 
    raw?: any 
  } | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'new' | 'edit'>('new');
  const [clienteToEdit, setClienteToEdit] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await salesFunnelService.getLead(Number(id));
        setLead(data);
        setForm({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          stage: data.stage,
          lead_source: data.lead_source,
          insurance_type: data.insurance_type,
          potential_value: data.potential_value,
          close_probability: data.close_probability,
          quality_rating: data.quality_rating,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar negocio');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Buscar clientes por query (debounce) - igual que en pólizas
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!clientQuery || clientQuery.trim().length < 2) {
        setClientResults([]);
        return;
      }
      try {
        setClientLoading(true);
        const resp = await saasApi.getClientes({ search: clientQuery, per_page: 10 });
        const arr = Array.isArray(resp.data) ? (resp.data as any) : (resp.data?.data || []);
        const normalized = arr.map((c: any) => {
          const tipo = c.tipo;
          const nombre = tipo === 'EMPRESA' ? (c.empresa?.razon_social || c.empresa?.nombre_comercial || 'Empresa') : `${c.persona?.nombres || c.nombre || ''} ${c.persona?.apellidos || c.apellidos || ''}`.trim();
          const documento = tipo === 'EMPRESA' ? c.empresa?.nit : c.persona?.documento || c.cuit;
          const celular = c.celular || c.celular_principal;
          const email = c.email || c.email_principal;
          return { id: String(c.id), nombre, documento, celular, email, raw: c };
        });
        setClientResults(normalized);
      } catch (e) {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [clientQuery]);

  // Función para seleccionar un cliente y llenar el formulario
  const handleClientSelect = (client: any) => {
    setSelectedClient(client);
    setClientQuery('');
    setClientResults([]);
    
    // Llenar el formulario con los datos del cliente basado en el tipo
    const c = client.raw;
    const tipo = c?.tipo;
    
    let firstName = '';
    let lastName = '';
    let email = '';
    let phone = '';
    
    if (tipo === 'EMPRESA') {
      // Para empresas, usar representante legal o razón social
      firstName = c.empresa?.representante_legal || c.empresa?.razon_social || '';
      lastName = '';
      email = c.email || c.email_principal || '';
      phone = c.celular || c.celular_principal || '';
    } else {
      // Para personas
      firstName = c.persona?.nombres || c.nombre || '';
      lastName = c.persona?.apellidos || c.apellidos || '';
      email = c.email || c.email_principal || '';
      phone = c.celular || c.celular_principal || '';
    }
    
    setForm(prev => ({
      ...prev,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que se haya seleccionado un cliente (opcional en edición)
    // if (!selectedClient) {
    //   setError('Debe seleccionar un cliente antes de guardar los cambios');
    //   return;
    // }

    try {
      setSaving(true);
      
      // Preparar datos validados según el controlador backend
      const dataToSend: any = {};
      
      // Campos de texto (string)
      if (form.first_name?.trim()) dataToSend.first_name = form.first_name.trim();
      if (form.last_name?.trim()) dataToSend.last_name = form.last_name.trim();
      if (form.email?.trim()) dataToSend.email = form.email.trim();
      if (form.phone?.trim()) dataToSend.phone = form.phone.trim();
      
      // Campos de selección (deben estar en las constantes del backend)
      if (form.stage) dataToSend.stage = form.stage;
      if (form.insurance_type) dataToSend.insurance_type = form.insurance_type;
      if (form.lead_source) dataToSend.lead_source = form.lead_source;
      if (form.quality_rating) dataToSend.quality_rating = form.quality_rating;
      
      // Campo requerido por el backend
      dataToSend.preferred_contact_method = form.preferred_contact_method || 'phone';
      
      // Campos numéricos (validar rangos)
      if (form.potential_value !== undefined && form.potential_value !== null) {
        const value = Number(form.potential_value);
        if (!isNaN(value) && value >= 0) {
          dataToSend.potential_value = value;
        }
      }
      
      if (form.close_probability !== undefined && form.close_probability !== null) {
        const prob = Number(form.close_probability);
        if (!isNaN(prob) && prob >= 0 && prob <= 100) {
          dataToSend.close_probability = prob;
        }
      }
      
      // Añadir estado en notes si se cambió
      if (form.business_state) {
        dataToSend.notes = `Estado: ${form.business_state}`;
      }
      
      console.log('Datos a enviar al backend:', dataToSend);
      
      await salesFunnelService.updateLead(Number(id), dataToSend);
      navigate(`/apps/saas/sales-funnel/${id}`);
    } catch (e) {
      console.error('Error al actualizar negocio:', e);
      
      // Mostrar error más específico si viene del servidor
      let errorMessage = 'Error al actualizar negocio';
      if (e instanceof Error) {
        errorMessage = e.message;
      }
      if ((e as any)?.response?.data?.message) {
        errorMessage = (e as any).response.data.message;
      }
      if ((e as any)?.response?.data?.errors) {
        const errors = (e as any).response.data.errors;
        errorMessage = Object.values(errors).flat().join(', ');
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      <span className="ml-2">Cargando negocio...</span>
    </div>
  );

  if (!lead) return (
    <div className="p-6">
      <Alert color="failure">Negocio no encontrado</Alert>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editar Negocio</h1>
        <p className="text-gray-600 dark:text-gray-400">Actualiza los datos del negocio</p>
      </div>

      {error && (
        <Alert color="failure">{error}</Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <TitleCard title="Selección de Cliente">
          <div className="space-y-4">
            <div className="relative">
              <Label className="text-sm font-medium text-gray-900 dark:text-white mb-1 block">
                Buscar y seleccionar cliente
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre, documento, teléfono o email"
                  value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                  onChange={(e) => { 
                    setSelectedClient(null); 
                    setClientQuery(e.target.value); 
                  }}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  color="primary" 
                  onClick={() => { 
                    setClientModalMode('new'); 
                    setClienteToEdit(null); 
                    setShowClientModal(true); 
                  }}
                >
                  <IconifyIcon icon="solar:user-plus-bold" className="w-4 h-4 mr-1" /> Nuevo
                </Button>
                {selectedClient && (
                  <Button 
                    type="button" 
                    color="light" 
                    onClick={() => { 
                      setClientModalMode('edit'); 
                      setClienteToEdit({ id: selectedClient.id, ...selectedClient.raw });
                      setShowClientModal(true); 
                    }}
                  >
                    <IconifyIcon icon="solar:pen-bold" className="w-4 h-4 mr-1" /> Editar
                  </Button>
                )}
              </div>
              
              {/* Dropdown de resultados */}
              {(!selectedClient && clientQuery && clientResults.length > 0) && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-[10px] shadow-lg max-h-60 overflow-y-auto">
                  {clientResults.map((client) => (
                    <div
                      key={client.id}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      onClick={() => handleClientSelect(client)}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{client.nombre}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {client.documento && `Doc: ${client.documento}`}
                        {client.celular && ` • Tel: ${client.celular}`}
                        {client.email && ` • ${client.email}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Loading de búsqueda */}
              {clientLoading && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-[10px] shadow-lg p-3">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Buscando clientes...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TitleCard>

        <TitleCard title="Información del Contacto">
          {!selectedClient && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <IconifyIcon icon="solar:info-circle-bold" className="w-5 h-5 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  Selecciona un cliente para habilitar los campos de contacto
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="first_name"
              name="first_name"
              label="Nombres"
              value={form.first_name || ''}
              onChange={onChange}
              placeholder="Nombres del contacto"
              disabled={!selectedClient}
              readOnly={!selectedClient}
            />
            <FormField
              id="last_name"
              name="last_name"
              label="Apellidos"
              value={form.last_name || ''}
              onChange={onChange}
              placeholder="Apellidos del contacto"
              disabled={!selectedClient}
              readOnly={!selectedClient}
            />
            <FormField
              id="email"
              name="email"
              label="Email"
              type="email"
              value={form.email || ''}
              onChange={onChange}
              placeholder="email@ejemplo.com"
              disabled={!selectedClient}
              readOnly={!selectedClient}
            />
            <FormField
              id="phone"
              name="phone"
              label="Teléfono"
              type="tel"
              value={form.phone || ''}
              onChange={onChange}
              placeholder="Número de teléfono"
              disabled={!selectedClient}
              readOnly={!selectedClient}
            />
          </div>
        </TitleCard>

        <TitleCard title="Estado del Negocio">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="business_state"
              name="business_state"
              label="Estado Actual"
              type="select"
              value={form.business_state || 'nuevo'}
              onChange={onChange}
              options={Object.entries(BUSINESS_STATES).map(([k, v]) => ({ value: k, label: v.label }))}
            />
            <div>
              <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">Vista Previa</Label>
              <div className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                <IconifyIcon 
                  icon={BUSINESS_STATES[(form.business_state || 'nuevo') as keyof typeof BUSINESS_STATES]?.icon || 'solar:star-bold-duotone'} 
                  className="w-5 h-5" 
                />
                <span className="font-medium">
                  {BUSINESS_STATES[(form.business_state || 'nuevo') as keyof typeof BUSINESS_STATES]?.label || 'Nuevo'}
                </span>
              </div>
            </div>
          </div>
        </TitleCard>

        <TitleCard title="Detalles del Negocio">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              id="stage"
              name="stage"
              label="Etapa"
              type="select"
              value={form.stage || ''}
              onChange={onChange}
              options={Object.entries(STAGES).map(([k, v]) => ({ value: k, label: v }))}
            />
            <FormField
              id="insurance_type"
              name="insurance_type"
              label="Ramo de Seguro"
              type="select"
              value={form.insurance_type || ''}
              onChange={onChange}
              options={Object.entries(INSURANCE_TYPES).map(([k, v]) => ({ value: k, label: v }))}
            />
            <FormField
              id="lead_source"
              name="lead_source"
              label="Origen del Negocio"
              type="select"
              value={form.lead_source || ''}
              onChange={onChange}
              options={Object.entries(LEAD_SOURCES).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField
              id="potential_value"
              name="potential_value"
              label="Valor Potencial"
              type="number"
              value={String(form.potential_value || 0)}
              onChange={onChange}
              placeholder="0"
            />
            <FormField
              id="close_probability"
              name="close_probability"
              label="Probabilidad de Cierre (%)"
              type="number"
              value={String(form.close_probability || 0)}
              onChange={onChange}
              placeholder="0"
            />
            <FormField
              id="quality_rating"
              name="quality_rating"
              label="Calidad del Negocio"
              type="select"
              value={form.quality_rating || ''}
              onChange={onChange}
              options={Object.entries(QUALITY_RATINGS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
        </TitleCard>

        <div className="flex justify-end gap-4">
          <Button type="button" color="light" onClick={() => navigate(`/apps/saas/sales-funnel/${id}`)} className="rounded-[10px]">Cancelar</Button>
          <Button type="submit" disabled={saving} color="primary" className="rounded-[10px] bg-blue-600 hover:bg-blue-700">{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
        </div>
      </form>

      {/* Modal para crear/editar cliente */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)} size="7xl">
        <Modal.Header>{clientModalMode === 'edit' ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Header>
        <Modal.Body>
          <div className="max-h-[80vh] overflow-auto p-1">
            <NuevoCliente
              isEditMode={clientModalMode === 'edit'}
              clienteToEdit={clientModalMode === 'edit' ? clienteToEdit : undefined}
              onSaveSuccess={(clienteActualizado?: any) => {
                setShowClientModal(false);
                if (clienteActualizado) {
                  const c = clienteActualizado;
                  const nombre = `${c?.nombre || ''} ${c?.apellidos || ''}`.trim() || c?.razon_social || 'Cliente';
                  const newSelectedClient = {
                    id: String(c.id),
                    nombre,
                    documento: c.cuit || c.document_number || '',
                    celular: c.celular_principal || c.phone || '',
                    email: c.email_principal || c.email || '',
                    raw: c,
                  };
                  setSelectedClient(newSelectedClient);
                  
                  // Llenar el formulario con los datos del cliente
                  setForm(prev => ({
                    ...prev,
                    first_name: c?.nombre || '',
                    last_name: c?.apellidos || '',
                    email: c.email_principal || c.email || '',
                    phone: c.celular_principal || c.phone || ''
                  }));
                }
              }}
            />
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default EditarLead;



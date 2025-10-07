import React, { useEffect, useState } from 'react';
import { Button, Alert, Modal } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';
import { saasApi } from 'src/services/saasApi';
import salesFunnelService, { CreateLeadData, STAGES, INSURANCE_TYPES, LEAD_SOURCES, QUALITY_RATINGS } from 'src/services/salesFunnelService';

const NuevoLead: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateLeadData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    stage: 'lead',
    lead_source: 'website',
    insurance_type: 'auto',
    potential_value: 0,
    close_probability: 20,
    preferred_contact_method: 'phone',
    quality_rating: 'warm',
  });

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
    setError(null);

    // Validar que se haya seleccionado un cliente
    if (!selectedClient) {
      setError('Debe seleccionar un cliente antes de crear el negocio');
      return;
    }

    try {
      setLoading(true);
      const dataToSend: CreateLeadData = {
        ...form,
        client_id: selectedClient.id ? Number(selectedClient.id) : undefined // Añadir ID del cliente seleccionado
      };
      const res = await salesFunnelService.createLead(dataToSend);
      if (res?.data) navigate(`/apps/saas/sales-funnel/${res.data.id}`);
      else navigate('/apps/saas/sales-funnel');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nuevo Negocio</h1>
        <p className="text-gray-600 dark:text-gray-400">Registra un nuevo negocio en el embudo</p>
      </div>

      {error && (
        <Alert color="failure">{error}</Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <TitleCard title="Selección de Cliente">
          <div className="space-y-4">
            <div className="relative">
              <Label className="text-sm font-medium text-gray-900 dark:text-white mb-1 block">
                Buscar y seleccionar cliente <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre, documento, teléfono o email"
                  value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                  onChange={(e) => { 
                    setSelectedClient(null); 
                    setClientQuery(e.target.value); 
                    // Limpiar formulario cuando se deselecciona cliente
                    if (!e.target.value) {
                      setForm(prev => ({
                        ...prev,
                        first_name: '',
                        last_name: '',
                        email: '',
                        phone: ''
                      }));
                    }
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
                  <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-1" /> Nuevo
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
                    <Icon icon="solar:pen-bold" className="w-4 h-4 mr-1" /> Editar
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
                <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-yellow-600 mr-2" />
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
              value={form.first_name}
              onChange={onChange}
              required
              placeholder="Nombres del contacto"
              disabled={!selectedClient}
              readOnly={!selectedClient}
            />
            <FormField
              id="last_name"
              name="last_name"
              label="Apellidos"
              value={form.last_name}
              onChange={onChange}
              required
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

        <TitleCard title="Detalles del Negocio">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              id="stage"
              name="stage"
              label="Etapa"
              type="select"
              value={form.stage}
              onChange={onChange}
              required
              options={Object.entries(STAGES).map(([k, v]) => ({ value: k, label: v }))}
            />
            <FormField
              id="insurance_type"
              name="insurance_type"
              label="Ramo de Seguro"
              type="select"
              value={form.insurance_type}
              onChange={onChange}
              required
              options={Object.entries(INSURANCE_TYPES).map(([k, v]) => ({ value: k, label: v }))}
            />
            <FormField
              id="lead_source"
              name="lead_source"
              label="Origen del Negocio"
              type="select"
              value={form.lead_source}
              onChange={onChange}
              required
              options={Object.entries(LEAD_SOURCES).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField
              id="potential_value"
              name="potential_value"
              label="Valor Potencial"
              type="number"
              value={String(form.potential_value)}
              onChange={onChange}
              placeholder="0"
            />
            <FormField
              id="close_probability"
              name="close_probability"
              label="Probabilidad de Cierre (%)"
              type="number"
              value={String(form.close_probability)}
              onChange={onChange}
              placeholder="0"
            />
            <FormField
              id="quality_rating"
              name="quality_rating"
              label="Calidad del Negocio"
              type="select"
              value={form.quality_rating}
              onChange={onChange}
              required
              options={Object.entries(QUALITY_RATINGS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
        </TitleCard>

        <div className="flex justify-end gap-4">
          <Button type="button" color="light" onClick={() => navigate('/apps/saas/sales-funnel')} className="rounded-[10px]">Cancelar</Button>
          <Button 
            type="submit" 
            disabled={loading || !selectedClient} 
            color="primary" 
            className="rounded-[10px] bg-blue-600 hover:bg-blue-700"
            title={!selectedClient ? 'Selecciona un cliente para continuar' : ''}
          >
            {loading ? 'Guardando...' : 'Crear Negocio'}
          </Button>
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
                    email: c?.email_principal || c?.email || '',
                    phone: c?.celular_principal || c?.phone || ''
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

export default NuevoLead;



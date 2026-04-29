import React, { useEffect, useState } from 'react';
import { Button, Alert, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';
import { saasApi } from 'src/services/saasApi';
import salesFunnelService, {
  CreateLeadData,
  STAGES,
  INSURANCE_TYPES,
  LEAD_SOURCES,
  QUALITY_RATINGS,
} from 'src/services/salesFunnelService';

interface NuevoNegocioModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess?: (lead: any) => void;
}

const NuevoNegocioModal: React.FC<NuevoNegocioModalProps> = ({ show, onClose, onSuccess }) => {
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
    raw?: any;
  } | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'new' | 'edit'>('new');
  const [clienteToEdit, setClienteToEdit] = useState<any | null>(null);

  // Catálogo de vendedores para el campo Referido
  const [vendedores, setVendedores] = useState<Array<{ id: number | string; nombre: string }>>([]);
  useEffect(() => {
    if (!show) return;
    (async () => {
      try {
        const r = await saasApi.getVendedores();
        const arr = (r as any)?.data?.data || (r as any)?.data || [];
        setVendedores(
          (Array.isArray(arr) ? arr : []).map((v: any) => ({
            id: v.id,
            nombre: [v.nombres || v.first_name, v.apellidos || v.last_name].filter(Boolean).join(' ') || v.nombre || `Vendedor ${v.id}`,
          })),
        );
      } catch { /* opcional */ }
    })();
  }, [show]);

  // Reset form cuando se cierra el modal
  useEffect(() => {
    if (!show) {
      setForm({
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
      setSelectedClient(null);
      setClientQuery('');
      setClientResults([]);
      setError(null);
    }
  }, [show]);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Buscar clientes por query (debounce)
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!clientQuery || clientQuery.trim().length < 2) {
        setClientResults([]);
        return;
      }
      try {
        setClientLoading(true);
        const resp = await saasApi.getClientes({ search: clientQuery, per_page: 10 });
        const arr = Array.isArray(resp.data) ? (resp.data as any) : resp.data?.data || [];
        const normalized = arr.map((c: any) => {
          const tipo = c.tipo;
          const nombre =
            tipo === 'EMPRESA'
              ? c.empresa?.razon_social || c.empresa?.nombre_comercial || 'Empresa'
              : `${c.persona?.nombres || c.nombre || ''} ${
                  c.persona?.apellidos || c.apellidos || ''
                }`.trim();
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

    const c = client.raw;
    const tipo = c?.tipo;

    let firstName = '';
    let lastName = '';
    let email = '';
    let phone = '';
    let documentType = '';
    let documentNumber = '';
    let city = '';
    let department = '';
    let address = '';

    if (tipo === 'EMPRESA') {
      firstName = c.empresa?.representante_legal || c.empresa?.razon_social || '';
      lastName = '';
      email = c.email || c.email_principal || '';
      phone = c.celular || c.celular_principal || '';
      documentType = 'NIT';
      documentNumber = c.empresa?.nit || c.cuit || '';
      city = c.ciudad || c.empresa?.ciudad || '';
      department = c.departamento || c.empresa?.departamento || '';
      address = c.direccion || c.empresa?.direccion || '';
    } else {
      firstName = c.persona?.nombres || c.nombre || '';
      lastName = c.persona?.apellidos || c.apellidos || '';
      email = c.email || c.email_principal || '';
      phone = c.celular || c.celular_principal || '';
      documentType = c.persona?.tipo_documento || c.tipo_documento || 'CC';
      documentNumber = c.persona?.documento || c.document_number || c.cuit || '';
      city = c.ciudad || c.persona?.ciudad || '';
      department = c.departamento || c.persona?.departamento || '';
      address = c.direccion || c.persona?.direccion || '';
    }

    setForm((prev) => ({
      ...prev,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      document_type: documentType,
      document_number: documentNumber,
      city: city,
      department: department,
      address: address,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClient) {
      setError('Debe seleccionar un cliente antes de crear el negocio');
      return;
    }

    try {
      setLoading(true);
      const dataToSend: CreateLeadData = {
        ...form,
        client_id: selectedClient.id ? Number(selectedClient.id) : undefined,
      };
      const res: any = await salesFunnelService.createLead(dataToSend);
      // Backend devuelve {message, lead} — compatibilidad con {data} por si cambia.
      const createdLead = res?.lead ?? res?.data ?? null;
      if (onSuccess) onSuccess(createdLead);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal show={show} onClose={onClose} size="5xl">
        <Modal.Header>Nuevo Negocio</Modal.Header>
        <Modal.Body>
          <div className="max-h-[75vh] overflow-y-auto scrollbar-hide">
            {error && (
              <Alert color="failure" className="mb-4">
                {error}
              </Alert>
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
                        value={
                          selectedClient
                            ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})`
                            : clientQuery
                        }
                        onChange={(e) => {
                          setSelectedClient(null);
                          setClientQuery(e.target.value);
                          if (!e.target.value) {
                            setForm((prev) => ({
                              ...prev,
                              first_name: '',
                              last_name: '',
                              email: '',
                              phone: '',
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
                    {!selectedClient && clientQuery && clientResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-[10px] shadow-lg max-h-60 overflow-y-auto">
                        {clientResults.map((client) => (
                          <div
                            key={client.id}
                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => handleClientSelect(client)}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {client.nombre}
                            </div>
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
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Buscando clientes...
                          </span>
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
                      <Icon
                        icon="solar:info-circle-bold"
                        className="w-5 h-5 text-yellow-600 mr-2"
                      />
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
                    options={Object.entries(INSURANCE_TYPES).map(([k, v]) => ({
                      value: k,
                      label: v,
                    }))}
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
                  {(form.insurance_type === 'auto' || form.insurance_type === 'motorcycle') && (
                    <div className="md:col-span-1">
                      <Label className="text-sm font-medium text-gray-900 dark:text-white mb-1 block">
                        Placa del vehículo
                      </Label>
                      <Input
                        id="placa"
                        name="placa"
                        value={(form as any).placa || ''}
                        onChange={onChange}
                        placeholder="Ej: ABC123"
                        className="mt-1 rounded-[10px]"
                      />
                    </div>
                  )}
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
                    options={Object.entries(QUALITY_RATINGS).map(([k, v]) => ({
                      value: k,
                      label: v,
                    }))}
                  />
                </div>
              </TitleCard>

              {/* Referido + próximo contacto (opcional) */}
              <TitleCard title="Referido & seguimiento (opcional)" description="Origen del referido y próxima fecha de contacto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    id="referrer_type"
                    name="referrer_type"
                    label="¿Quién refirió?"
                    type="select"
                    value={(form as any).referrer_type || ''}
                    onChange={onChange}
                    options={[
                      { value: '', label: '— sin referido —' },
                      { value: 'vendedor', label: 'Vendedor interno' },
                      { value: 'otro', label: 'Otro (persona externa)' },
                    ]}
                  />
                  {(form as any).referrer_type === 'vendedor' && (
                    <FormField
                      id="referrer_vendedor_id"
                      name="referrer_vendedor_id"
                      label="Vendedor"
                      type="select"
                      value={String((form as any).referrer_vendedor_id || '')}
                      onChange={onChange}
                      options={[
                        { value: '', label: '— seleccionar —' },
                        ...vendedores.map((v) => ({ value: String(v.id), label: v.nombre })),
                      ]}
                    />
                  )}
                  {(form as any).referrer_type === 'otro' && (
                    <div className="md:col-span-2">
                      <Label htmlFor="referrer_name">Nombre del referido</Label>
                      <Input
                        id="referrer_name"
                        name="referrer_name"
                        value={(form as any).referrer_name || ''}
                        onChange={(e) => setForm((p) => ({ ...p, referrer_name: e.target.value } as any))}
                        placeholder="Nombre completo"
                      />
                    </div>
                  )}
                  <div className={(form as any).referrer_type === 'otro' ? 'md:col-span-3' : 'md:col-span-2'}>
                    <Label htmlFor="next_follow_up_at">Próxima fecha de contacto</Label>
                    <Input
                      id="next_follow_up_at"
                      name="next_follow_up_at"
                      type="datetime-local"
                      value={(form as any).next_follow_up_at || ''}
                      onChange={(e) => setForm((p) => ({ ...p, next_follow_up_at: e.target.value } as any))}
                    />
                    <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">
                      Si la defines, se crea automáticamente una tarea en Seguimiento y Calendario.
                    </p>
                  </div>
                </div>
              </TitleCard>
            </form>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="light" onClick={onClose} className="rounded-[10px]">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || !selectedClient}
            color="primary"
            className="rounded-[10px]"
            title={!selectedClient ? 'Selecciona un cliente para continuar' : ''}
          >
            {loading ? 'Guardando...' : 'Crear Negocio'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para crear/editar cliente */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)} size="7xl">
        <Modal.Header>
          {clientModalMode === 'edit' ? 'Editar cliente' : 'Nuevo cliente'}
        </Modal.Header>
        <Modal.Body>
          <div className="max-h-[80vh] overflow-auto scrollbar-hide p-1">
            <NuevoCliente
              isEditMode={clientModalMode === 'edit'}
              clienteToEdit={clientModalMode === 'edit' ? clienteToEdit : undefined}
              onSaveSuccess={(clienteActualizado?: any) => {
                setShowClientModal(false);
                if (clienteActualizado) {
                  const c = clienteActualizado;
                  const nombre =
                    `${c?.nombre || ''} ${c?.apellidos || ''}`.trim() ||
                    c?.razon_social ||
                    'Cliente';
                  const newSelectedClient = {
                    id: String(c.id),
                    nombre,
                    documento: c.cuit || c.document_number || '',
                    celular: c.celular_principal || c.phone || '',
                    email: c.email_principal || c.email || '',
                    raw: c,
                  };
                  setSelectedClient(newSelectedClient);

                  setForm((prev) => ({
                    ...prev,
                    first_name: c?.nombre || '',
                    last_name: c?.apellidos || '',
                    email: c?.email_principal || c?.email || '',
                    phone: c?.celular_principal || c?.phone || '',
                  }));
                }
              }}
            />
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default NuevoNegocioModal;

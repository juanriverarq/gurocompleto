import React, { useEffect, useState } from 'react';
import { Button, Alert, Modal, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';
import { saasApi } from 'src/services/saasApi';
import salesFunnelService, { UpdateLeadData, SalesFunnelLead, STAGES, INSURANCE_TYPES, LEAD_SOURCES, QUALITY_RATINGS } from 'src/services/salesFunnelService';

interface EditarNegocioModalProps {
  show: boolean;
  onClose: () => void;
  leadId: number;
  onSuccess?: (lead: SalesFunnelLead) => void;
}

const EditarNegocioModal: React.FC<EditarNegocioModalProps> = ({ show, onClose, leadId, onSuccess }) => {
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

  // Cargar datos del lead cuando se abre el modal
  useEffect(() => {
    if (show && leadId) {
      const load = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await salesFunnelService.getLead(leadId);
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
      load();
    }
  }, [show, leadId]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
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
    
    if (tipo === 'EMPRESA') {
      firstName = c.empresa?.representante_legal || c.empresa?.razon_social || '';
      lastName = '';
      email = c.email || c.email_principal || '';
      phone = c.celular || c.celular_principal || '';
    } else {
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

    try {
      setSaving(true);
      const res = await salesFunnelService.updateLead(leadId, form);
      if (res?.data && onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar negocio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal show={show} onClose={onClose} size="5xl">
        <Modal.Header>Editar Negocio</Modal.Header>
        <Modal.Body>
          <div className="max-h-[75vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
                <span className="ml-3">Cargando negocio...</span>
              </div>
            ) : error && !lead ? (
              <Alert color="failure">{error}</Alert>
            ) : (
              <>
                {error && (
                  <Alert color="failure" className="mb-4">{error}</Alert>
                )}

                <form onSubmit={onSubmit} className="space-y-6">
                  <TitleCard title="Información del Contacto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        id="first_name"
                        name="first_name"
                        label="Nombres"
                        value={form.first_name || ''}
                        onChange={onChange}
                        required
                        placeholder="Nombres del contacto"
                      />
                      <FormField
                        id="last_name"
                        name="last_name"
                        label="Apellidos"
                        value={form.last_name || ''}
                        onChange={onChange}
                        required
                        placeholder="Apellidos del contacto"
                      />
                      <FormField
                        id="email"
                        name="email"
                        label="Email"
                        type="email"
                        value={form.email || ''}
                        onChange={onChange}
                        placeholder="email@ejemplo.com"
                      />
                      <FormField
                        id="phone"
                        name="phone"
                        label="Teléfono"
                        type="tel"
                        value={form.phone || ''}
                        onChange={onChange}
                        placeholder="Número de teléfono"
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
                        value={form.stage || ''}
                        onChange={onChange}
                        required
                        options={Object.entries(STAGES).map(([k, v]) => ({ value: k, label: v }))}
                      />
                      <FormField
                        id="insurance_type"
                        name="insurance_type"
                        label="Ramo de Seguro"
                        type="select"
                        value={form.insurance_type || ''}
                        onChange={onChange}
                        required
                        options={Object.entries(INSURANCE_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                      />
                      <FormField
                        id="lead_source"
                        name="lead_source"
                        label="Origen del Negocio"
                        type="select"
                        value={form.lead_source || ''}
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
                        required
                        options={Object.entries(QUALITY_RATINGS).map(([k, v]) => ({ value: k, label: v }))}
                      />
                    </div>
                  </TitleCard>
                </form>
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="light" onClick={onClose} className="rounded-[10px]" disabled={saving}>
            Cancelar
          </Button>
          <Button 
            type="button"
            onClick={onSubmit}
            disabled={saving || loading} 
            color="primary" 
            className="rounded-[10px] bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para crear/editar cliente */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)} size="7xl">
        <Modal.Header>{clientModalMode === 'edit' ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Header>
        <Modal.Body>
          <div className="max-h-[80vh] overflow-auto scrollbar-hide p-1">
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
    </>
  );
};

export default EditarNegocioModal;

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { Badge, Button, Modal, Spinner, TextInput, Textarea, Select, Table, Checkbox, Label, Progress } from 'flowbite-react';
import { auth } from 'src/config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

interface Template {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
  parsed?: {
    header?: { type: string; text?: string };
    body?: string;
    footer?: string;
    buttons?: { type: string; text: string }[];
  };
}

interface Campaign {
  id: number;
  name: string;
  description?: string;
  campaign_type: string;
  template_name?: string;
  template_language?: string;
  message_template: string;
  status: string;
  total_targets: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
  stats?: { sent: number; delivered: number; failed: number; read: number; pending: number };
}

interface Client {
  id: number;
  nombre: string;
  apellidos: string;
  celular_principal: string;
  email_principal?: string;
  ciudad?: string;
  estado: string;
  polizas?: any[];
}

// Variable mapping options from client data
const VARIABLE_SOURCES = [
  { value: 'fixed', label: 'Valor fijo (escribir)' },
  { value: 'nombre', label: 'Nombre del cliente' },
  { value: 'nombre_completo', label: 'Nombre completo' },
  { value: 'apellidos', label: 'Apellidos' },
  { value: 'celular_principal', label: 'Teléfono' },
  { value: 'email_principal', label: 'Email' },
  { value: 'ciudad', label: 'Ciudad' },
  { value: 'poliza_numero', label: 'Número de póliza (primera)' },
  { value: 'poliza_producto', label: 'Producto de póliza (primera)' },
  { value: 'poliza_aseguradora', label: 'Aseguradora (primera)' },
  { value: 'poliza_vigencia', label: 'Vigencia de póliza (primera)' },
];

const WhatsAppCampanas: React.FC = () => {
  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create campaign wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');

  // Variable mapping
  const [variableMapping, setVariableMapping] = useState<Record<string, { source: string; fixedValue: string }>>({});

  // Audience
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectAllClients, setSelectAllClients] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [clientSearch, setClientSearch] = useState('');

  // Sending
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // Campaign detail
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No autenticado');
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);
    return data;
  }, []);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/saas/campaigns');
      setCampaigns(data.data || data.campaigns || data || []);
    } catch (err: any) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Load approved templates
  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await apiFetch('/saas/whatsapp-inbox/templates?status=APPROVED');
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError('Error cargando plantillas: ' + err.message);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load clients
  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const data = await apiFetch('/saas/clientes?per_page=500');
      setClients(data.data || data || []);
    } catch (err: any) {
      console.error('Error loading clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  // Extract template variables
  const extractVars = (body: string): string[] => {
    const matches = body.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map(m => m.replace(/[{}]/g, '').trim()) : [];
  };

  // Open wizard
  const openWizard = () => {
    setShowWizard(true);
    setWizardStep(1);
    setSelectedTemplate(null);
    setCampaignName('');
    setCampaignDescription('');
    setVariableMapping({});
    setSelectAllClients(true);
    setSelectedClientIds(new Set());
    setSendResult(null);
    loadTemplates();
  };

  // Select template
  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl);
    const body = tpl.parsed?.body || '';
    const vars = extractVars(body);
    const mapping: Record<string, { source: string; fixedValue: string }> = {};
    vars.forEach(v => {
      // Auto-map common variables
      if (v === '1' || v.toLowerCase().includes('name') || v.toLowerCase().includes('nombre')) {
        mapping[v] = { source: 'nombre_completo', fixedValue: '' };
      } else if (v.toLowerCase().includes('poliza') || v.toLowerCase().includes('policy')) {
        mapping[v] = { source: 'poliza_numero', fixedValue: '' };
      } else {
        mapping[v] = { source: 'fixed', fixedValue: '' };
      }
    });
    setVariableMapping(mapping);
    setCampaignName(`Campaña - ${tpl.name}`);
    setWizardStep(2);
  };

  // Go to audience step
  const goToAudience = () => {
    if (!campaignName.trim()) {
      setError('Ingresa un nombre para la campaña');
      return;
    }
    setError('');
    loadClients();
    setWizardStep(3);
  };

  // Toggle client selection
  const toggleClient = (id: number) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered clients
  const filteredClients = clients.filter(c => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.apellidos || '').toLowerCase().includes(q) ||
      (c.celular_principal || '').includes(q) ||
      (c.ciudad || '').toLowerCase().includes(q)
    );
  });

  // Resolve variable value for a contact
  const resolveVariable = (varName: string, contact: any): string => {
    const mapping = variableMapping[varName];
    if (!mapping) return varName;
    if (mapping.source === 'fixed') return mapping.fixedValue || varName;
    switch (mapping.source) {
      case 'nombre': return contact.nombre || '';
      case 'nombre_completo': return `${contact.nombre || ''} ${contact.apellidos || ''}`.trim();
      case 'apellidos': return contact.apellidos || '';
      case 'celular_principal': return contact.celular_principal || '';
      case 'email_principal': return contact.email_principal || '';
      case 'ciudad': return contact.ciudad || '';
      case 'poliza_numero': return contact.polizas?.[0]?.numero_poliza || contact.polizas?.[0]?.policy_number || '';
      case 'poliza_producto': return contact.polizas?.[0]?.producto || contact.polizas?.[0]?.product_name || '';
      case 'poliza_aseguradora': return contact.polizas?.[0]?.aseguradora || contact.polizas?.[0]?.insurer_name || '';
      case 'poliza_vigencia': return contact.polizas?.[0]?.fecha_vencimiento || contact.polizas?.[0]?.end_date || '';
      default: return varName;
    }
  };

  // Send campaign
  const handleSendCampaign = async () => {
    if (!selectedTemplate) return;
    try {
      setSending(true);
      setError('');

      const targetClients = selectAllClients
        ? clients.filter(c => c.celular_principal)
        : clients.filter(c => selectedClientIds.has(c.id) && c.celular_principal);

      if (targetClients.length === 0) {
        setError('No hay clientes con teléfono para enviar');
        return;
      }

      const body = selectedTemplate.parsed?.body || '';
      const vars = extractVars(body);

      // Build contacts array with custom_data for variable resolution
      const contacts = targetClients.map(c => ({
        phone: c.celular_principal,
        name: `${c.nombre || ''} ${c.apellidos || ''}`.trim(),
        policy_id: c.polizas?.[0]?.id || null,
        custom_data: Object.fromEntries(
          vars.map(v => [v, resolveVariable(v, c)])
        ),
      }));

      // Build the message template text with variable placeholders for display
      let messageText = body;
      vars.forEach(v => {
        const mapping = variableMapping[v];
        if (mapping?.source === 'fixed' && mapping.fixedValue) {
          messageText = messageText.replace(`{{${v}}}`, mapping.fixedValue);
        }
      });

      const payload = {
        name: campaignName,
        description: campaignDescription,
        message_template: messageText,
        template_name: selectedTemplate.name,
        template_language: selectedTemplate.language || 'es',
        contacts,
        select_all_clients: selectAllClients,
        variable_mapping: variableMapping,
      };

      console.log('📤 [Campaign] Sending:', payload);
      const data = await apiFetch('/saas/campaigns/immediate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSendResult(data);
      setWizardStep(4);
      loadCampaigns();
    } catch (err: any) {
      console.error('Campaign error:', err);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Status badge
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'gray', active: 'info', sending: 'warning', completed: 'success', failed: 'failure', paused: 'purple',
    };
    const labels: Record<string, string> = {
      draft: 'Borrador', active: 'Activa', sending: 'Enviando', completed: 'Completada', failed: 'Fallida', paused: 'Pausada',
    };
    return <Badge color={colors[status] || 'gray'} size="sm">{labels[status] || status}</Badge>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:letter-bold-duotone" width={28} className="text-green-500" />
            Campañas WhatsApp
          </h1>
          <p className="text-sm text-gray-500 mt-1">Envía plantillas aprobadas por Meta a tus clientes de forma masiva</p>
        </div>
        <Button color="primary" onClick={openWizard}>
          <Icon icon="solar:add-circle-bold" className="mr-2" width={18} />
          Nueva campaña
        </Button>
      </div>

      {/* Error */}
      {error && !showWizard && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Campaigns list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="xl" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon icon="solar:letter-bold-duotone" width={40} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Sin campañas</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Crea tu primera campaña de WhatsApp con plantillas aprobadas por Meta</p>
          <Button color="primary" onClick={openWizard}>
            <Icon icon="solar:add-circle-bold" className="mr-2" width={18} />
            Crear campaña
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Campaña</Table.HeadCell>
              <Table.HeadCell>Plantilla</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Destinatarios</Table.HeadCell>
              <Table.HeadCell>Enviados</Table.HeadCell>
              <Table.HeadCell>Entregados</Table.HeadCell>
              <Table.HeadCell>Fallidos</Table.HeadCell>
              <Table.HeadCell>Fecha</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {campaigns.map(c => (
                <Table.Row key={c.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setSelectedCampaign(c)}>
                  <Table.Cell>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                      {c.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{c.description}</p>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{c.template_name || '—'}</span>
                  </Table.Cell>
                  <Table.Cell>{statusBadge(c.status)}</Table.Cell>
                  <Table.Cell>{c.total_targets}</Table.Cell>
                  <Table.Cell className="text-green-600">{c.stats?.sent || c.sent_count || 0}</Table.Cell>
                  <Table.Cell className="text-blue-600">{c.stats?.delivered || c.delivered_count || 0}</Table.Cell>
                  <Table.Cell className="text-red-600">{c.stats?.failed || c.failed_count || 0}</Table.Cell>
                  <Table.Cell className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('es-CO')}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      {/* ========== CREATE CAMPAIGN WIZARD ========== */}
      <Modal show={showWizard} onClose={() => setShowWizard(false)} size="4xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:letter-bold-duotone" width={22} className="text-green-500" />
            <span>Nueva campaña WhatsApp</span>
            <div className="flex items-center gap-1 ml-4">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${s <= wizardStep ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} />
              ))}
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 mb-4">
              {error}
              <button className="ml-2 underline" onClick={() => setError('')}>Cerrar</button>
            </div>
          )}

          {/* STEP 1: Select Template */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Selecciona una plantilla</h3>
                <p className="text-sm text-gray-500">Solo se muestran plantillas aprobadas por Meta. Las plantillas permiten enviar mensajes fuera de la ventana de 24 horas.</p>
              </div>

              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <Icon icon="solar:document-text-bold-duotone" width={40} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay plantillas aprobadas. Crea una desde la sección de Plantillas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {templates.map(tpl => {
                    const bodyText = tpl.parsed?.body || '';
                    const vars = extractVars(bodyText);
                    return (
                      <div
                        key={tpl.id}
                        className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate?.id === tpl.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                        }`}
                        onClick={() => handleSelectTemplate(tpl)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{tpl.name}</span>
                          <div className="flex gap-1">
                            <Badge color={tpl.category === 'MARKETING' ? 'purple' : 'info'} size="xs">
                              {tpl.category === 'MARKETING' ? 'Marketing' : 'Utilidad'}
                            </Badge>
                          </div>
                        </div>
                        {/* Preview */}
                        <div className="bg-[#e5ddd5] dark:bg-gray-900 rounded-lg p-2 mb-2">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 max-w-[240px]">
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">{bodyText}</p>
                          </div>
                        </div>
                        {vars.length > 0 && (
                          <p className="text-[10px] text-gray-500">
                            <Icon icon="solar:code-bold" width={12} className="inline mr-1" />
                            {vars.length} variable{vars.length > 1 ? 's' : ''}: {vars.map(v => `{{${v}}}`).join(', ')}
                          </p>
                        )}
                        {tpl.parsed?.buttons && tpl.parsed.buttons.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {tpl.parsed.buttons.map((btn, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full">{btn.text}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Campaign Details & Variable Mapping */}
          {wizardStep === 2 && selectedTemplate && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Configura la campaña</h3>
                <p className="text-sm text-gray-500">Plantilla: <span className="font-mono text-primary">{selectedTemplate.name}</span></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="campaign-name" value="Nombre de la campaña *" />
                  <TextInput
                    id="campaign-name"
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    placeholder="Ej: Reactivación febrero 2026"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-desc" value="Descripción (opcional)" />
                  <TextInput
                    id="campaign-desc"
                    value={campaignDescription}
                    onChange={e => setCampaignDescription(e.target.value)}
                    placeholder="Ej: Campaña para reactivar clientes inactivos"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Variable mapping */}
              {Object.keys(variableMapping).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="solar:code-bold-duotone" width={18} className="text-primary" />
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Mapeo de variables</h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Asigna de dónde se obtiene cada variable de la plantilla. Puedes usar datos del cliente (nombre, póliza, etc.) o un valor fijo para todos.
                  </p>
                  {Object.entries(variableMapping).map(([varName, mapping]) => (
                    <div key={varName} className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-lg p-3">
                      <span className="text-xs font-mono text-primary w-24 flex-shrink-0 font-medium">{`{{${varName}}}`}</span>
                      <Icon icon="solar:arrow-right-bold" width={14} className="text-gray-400 flex-shrink-0" />
                      <Select
                        value={mapping.source}
                        onChange={e => setVariableMapping(prev => ({
                          ...prev,
                          [varName]: { ...prev[varName], source: e.target.value }
                        }))}
                        className="flex-1"
                        sizing="sm"
                      >
                        {VARIABLE_SOURCES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </Select>
                      {mapping.source === 'fixed' && (
                        <TextInput
                          value={mapping.fixedValue}
                          onChange={e => setVariableMapping(prev => ({
                            ...prev,
                            [varName]: { ...prev[varName], fixedValue: e.target.value }
                          }))}
                          placeholder="Valor para todos"
                          sizing="sm"
                          className="w-40"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Template preview */}
              <div className="bg-[#e5ddd5] dark:bg-gray-900 rounded-xl p-4">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Vista previa del mensaje</p>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 max-w-sm">
                  {selectedTemplate.parsed?.header?.text && (
                    <p className="font-bold text-sm text-gray-900 dark:text-white mb-1">{selectedTemplate.parsed.header.text}</p>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedTemplate.parsed?.body || ''}
                  </p>
                  {selectedTemplate.parsed?.footer && (
                    <p className="text-xs text-gray-400 mt-2">{selectedTemplate.parsed.footer}</p>
                  )}
                  {selectedTemplate.parsed?.buttons && selectedTemplate.parsed.buttons.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2 space-y-1">
                      {selectedTemplate.parsed.buttons.map((btn, i) => (
                        <div key={i} className="text-center py-1 text-xs text-blue-500 font-medium border border-blue-50 dark:border-blue-900 rounded">
                          {btn.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button color="light" onClick={() => setWizardStep(1)}>
                  <Icon icon="solar:arrow-left-bold" className="mr-1" width={14} />
                  Cambiar plantilla
                </Button>
                <Button color="primary" onClick={goToAudience}>
                  Seleccionar audiencia
                  <Icon icon="solar:arrow-right-bold" className="ml-1" width={14} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Select Audience */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Selecciona la audiencia</h3>
                <p className="text-sm text-gray-500">Elige a quién enviar la plantilla <span className="font-mono text-primary">{selectedTemplate?.name}</span></p>
              </div>

              {/* Select all toggle */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <Checkbox
                  id="select-all"
                  checked={selectAllClients}
                  onChange={e => setSelectAllClients(e.target.checked)}
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  <span className="font-medium">Enviar a todos los clientes con teléfono</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({clients.filter(c => c.celular_principal).length} clientes)
                  </span>
                </Label>
              </div>

              {!selectAllClients && (
                <>
                  <TextInput
                    placeholder="Buscar cliente por nombre, teléfono o ciudad..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    icon={() => <Icon icon="solar:magnifer-bold" width={16} />}
                  />
                  <div className="max-h-[300px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                    {loadingClients ? (
                      <div className="flex items-center justify-center py-8"><Spinner /></div>
                    ) : (
                      <Table hoverable>
                        <Table.Head>
                          <Table.HeadCell className="w-10"></Table.HeadCell>
                          <Table.HeadCell>Nombre</Table.HeadCell>
                          <Table.HeadCell>Teléfono</Table.HeadCell>
                          <Table.HeadCell>Ciudad</Table.HeadCell>
                        </Table.Head>
                        <Table.Body className="divide-y">
                          {filteredClients.slice(0, 100).map(c => (
                            <Table.Row key={c.id}>
                              <Table.Cell>
                                <Checkbox
                                  checked={selectedClientIds.has(c.id)}
                                  onChange={() => toggleClient(c.id)}
                                  disabled={!c.celular_principal}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                <span className={!c.celular_principal ? 'text-gray-400' : ''}>
                                  {c.nombre} {c.apellidos}
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <span className={!c.celular_principal ? 'text-gray-400 italic' : 'font-mono text-xs'}>
                                  {c.celular_principal || 'Sin teléfono'}
                                </span>
                              </Table.Cell>
                              <Table.Cell className="text-xs text-gray-500">{c.ciudad || '—'}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {selectedClientIds.size} cliente{selectedClientIds.size !== 1 ? 's' : ''} seleccionado{selectedClientIds.size !== 1 ? 's' : ''}
                  </p>
                </>
              )}

              {/* Summary before send */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300 mb-2">Resumen de envío</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectAllClients ? clients.filter(c => c.celular_principal).length : selectedClientIds.size}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Destinatarios</p>
                  </div>
                  <div>
                    <p className="text-sm font-mono text-blue-600">{selectedTemplate?.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Plantilla</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">{selectedTemplate?.language === 'es' ? 'Español' : selectedTemplate?.language}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Idioma</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">{Object.keys(variableMapping).length}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Variables</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button color="light" onClick={() => setWizardStep(2)}>
                  <Icon icon="solar:arrow-left-bold" className="mr-1" width={14} />
                  Atrás
                </Button>
                <Button
                  color="success"
                  onClick={handleSendCampaign}
                  disabled={sending || (!selectAllClients && selectedClientIds.size === 0)}
                >
                  {sending ? (
                    <><Spinner size="sm" className="mr-2" /> Enviando...</>
                  ) : (
                    <>
                      <Icon icon="solar:plain-bold" className="mr-2" width={16} />
                      Enviar campaña
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Results */}
          {wizardStep === 4 && (
            <div className="text-center py-8 space-y-4">
              {sendResult?.success ? (
                <>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                    <Icon icon="solar:check-circle-bold" width={40} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">¡Campaña enviada!</h3>
                  <p className="text-sm text-gray-500">
                    Se enviaron {sendResult.total_messages || 0} mensajes usando la plantilla <span className="font-mono text-primary">{selectedTemplate?.name}</span>
                  </p>
                  <div className="flex gap-3 justify-center mt-4">
                    <Button color="light" onClick={() => setShowWizard(false)}>Cerrar</Button>
                    <Button color="primary" onClick={() => { setShowWizard(false); loadCampaigns(); }}>
                      Ver campañas
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                    <Icon icon="solar:close-circle-bold" width={40} className="text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Error al enviar</h3>
                  <p className="text-sm text-red-500">{sendResult?.message || error || 'Error desconocido'}</p>
                  <Button color="light" onClick={() => setWizardStep(3)}>Reintentar</Button>
                </>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* ========== CAMPAIGN DETAIL MODAL ========== */}
      <Modal show={!!selectedCampaign} onClose={() => setSelectedCampaign(null)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:chart-bold-duotone" width={20} className="text-primary" />
            Detalle de campaña
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedCampaign.name}</h3>
                {statusBadge(selectedCampaign.status)}
              </div>
              {selectedCampaign.description && (
                <p className="text-sm text-gray-500">{selectedCampaign.description}</p>
              )}
              {selectedCampaign.template_name && (
                <div className="flex items-center gap-2">
                  <Icon icon="solar:document-text-bold" width={16} className="text-blue-500" />
                  <span className="text-sm">Plantilla: <span className="font-mono text-primary">{selectedCampaign.template_name}</span></span>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCampaign.total_targets}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Total</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedCampaign.stats?.sent || selectedCampaign.sent_count || 0}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Enviados</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedCampaign.stats?.delivered || selectedCampaign.delivered_count || 0}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Entregados</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{selectedCampaign.stats?.failed || selectedCampaign.failed_count || 0}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Fallidos</p>
                </div>
              </div>
              {selectedCampaign.total_targets > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Progreso de entrega</p>
                  <Progress
                    progress={Math.round(((selectedCampaign.stats?.delivered || selectedCampaign.delivered_count || 0) / selectedCampaign.total_targets) * 100)}
                    color="blue"
                    size="lg"
                  />
                </div>
              )}
              <p className="text-xs text-gray-400">Creada: {new Date(selectedCampaign.created_at).toLocaleString('es-CO')}</p>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default WhatsAppCampanas;

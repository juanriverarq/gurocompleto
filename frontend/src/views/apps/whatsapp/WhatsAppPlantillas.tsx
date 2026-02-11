import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Spinner, Tooltip, Modal, Table, Textarea } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { auth } from 'src/config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

interface TemplateParsed {
  header: { format: string; text: string | null } | null;
  body: string | null;
  footer: string | null;
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

interface Template {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
  quality_score?: { score: string };
  rejected_reason?: string;
  parsed: TemplateParsed;
}

interface TemplateStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

type ButtonFormItem = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url: string; phone_number: string };

const WhatsAppPlantillas: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    category: 'MARKETING' as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
    language: 'es',
    header_type: 'NONE' as 'NONE' | 'TEXT',
    header_text: '',
    body: '',
    footer: '',
    buttons: [] as ButtonFormItem[],
    example_body_params: [] as string[],
  });

  const makeRequest = async (url: string, options: RequestInit = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No autenticado');
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    return data;
  };

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await makeRequest(`/saas/whatsapp-inbox/templates${params}`);
      setTemplates(data.templates || []);
      setStats(data.stats || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Extract variables from body text
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([a-z0-9_]+)\}\}/g);
    return matches ? matches.map(m => m.replace(/[{}]/g, '')) : [];
  };

  // Update example params when body changes
  useEffect(() => {
    const vars = extractVariables(form.body);
    setForm(f => ({
      ...f,
      example_body_params: vars.map((_, i) => f.example_body_params[i] || ''),
    }));
  }, [form.body]);

  const handleCreate = async () => {
    if (!form.name || !form.body) {
      setError('El nombre y el cuerpo del mensaje son obligatorios.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.name)) {
      setError('El nombre solo puede contener letras minúsculas, números y guiones bajos.');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const bodyVars = extractVariables(form.body);
      const payload: any = {
        name: form.name,
        category: form.category,
        language: form.language,
        header_type: form.header_type,
        body: form.body,
      };
      if (form.header_type === 'TEXT' && form.header_text) {
        payload.header_text = form.header_text;
      }
      if (form.footer) {
        payload.footer = form.footer;
      }
      if (form.buttons.length > 0) {
        payload.buttons = form.buttons.map(b => ({
          type: b.type,
          text: b.text,
          ...(b.type === 'URL' && b.url ? { url: b.url } : {}),
          ...(b.type === 'PHONE_NUMBER' && b.phone_number ? { phone_number: b.phone_number } : {}),
        }));
      }
      if (bodyVars.length > 0 && form.example_body_params.some(p => p)) {
        payload.example_body_params = form.example_body_params;
      }

      const data = await makeRequest('/saas/whatsapp-inbox/templates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccessMsg(data.message || 'Plantilla enviada a revisión');
      setShowCreateModal(false);
      resetForm();
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (templateName: string) => {
    if (!confirm(`¿Eliminar la plantilla "${templateName}"? Esta acción no se puede deshacer.`)) return;
    try {
      setDeleting(templateName);
      await makeRequest(`/saas/whatsapp-inbox/templates/${templateName}`, { method: 'DELETE' });
      setSuccessMsg('Plantilla eliminada');
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      category: 'MARKETING',
      language: 'es',
      header_type: 'NONE',
      header_text: '',
      body: '',
      footer: '',
      buttons: [],
      example_body_params: [],
    });
  };

  const addButton = () => {
    if (form.buttons.length >= 3) return;
    setForm(f => ({
      ...f,
      buttons: [...f.buttons, { type: 'QUICK_REPLY', text: '', url: '', phone_number: '' }],
    }));
  };

  const removeButton = (index: number) => {
    setForm(f => ({
      ...f,
      buttons: f.buttons.filter((_, i) => i !== index),
    }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setForm(f => ({
      ...f,
      buttons: f.buttons.map((b, i) => i === index ? { ...b, [field]: value } : b),
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge color="success" size="sm"><Icon icon="solar:check-circle-bold" width={12} className="mr-1" />Aprobada</Badge>;
      case 'PENDING': return <Badge color="warning" size="sm"><Icon icon="solar:clock-circle-bold" width={12} className="mr-1" />En revisión</Badge>;
      case 'REJECTED': return <Badge color="failure" size="sm"><Icon icon="solar:close-circle-bold" width={12} className="mr-1" />Rechazada</Badge>;
      default: return <Badge color="gray" size="sm">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'MARKETING': return <Badge color="purple" size="sm">Marketing</Badge>;
      case 'UTILITY': return <Badge color="info" size="sm">Utilidad</Badge>;
      case 'AUTHENTICATION': return <Badge color="gray" size="sm">Autenticación</Badge>;
      default: return <Badge color="gray" size="sm">{category}</Badge>;
    }
  };

  const getLanguageLabel = (code: string) => {
    const langs: Record<string, string> = {
      es: 'Español', en: 'English', en_US: 'English (US)', pt_BR: 'Português',
    };
    return langs[code] || code;
  };

  // Preview: render body with variable highlights
  const renderBodyPreview = (body: string | null) => {
    if (!body) return null;
    const parts = body.split(/(\{\{[a-z0-9_]+\}\})/g);
    return parts.map((part, i) =>
      part.match(/^\{\{[a-z0-9_]+\}\}$/)
        ? <span key={i} className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded text-xs font-mono">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Icon icon="solar:document-text-bold-duotone" width={28} className="text-blue-600" />
            </div>
            Plantillas de Mensaje
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Icon icon="logos:meta" width={14} />
            Gestión de plantillas aprobadas por Meta Cloud API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button color="light" size="sm" onClick={loadTemplates}>
            <Icon icon="solar:refresh-bold" className="mr-1.5" width={16} />
            Actualizar
          </Button>
          <Button color="primary" size="sm" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            <Icon icon="solar:add-circle-bold" className="mr-1.5" width={16} />
            Nueva plantilla
          </Button>
        </div>
      </div>

      {/* Success / Error messages */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
          <Icon icon="solar:check-circle-bold" width={18} className="text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
          <Icon icon="solar:danger-triangle-bold" width={18} className="text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <Icon icon="solar:close-circle-bold" width={16} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl">
                <Icon icon="solar:document-text-bold" width={20} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-[11px] text-gray-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-green-300 transition-colors" onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? '' : 'APPROVED')}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <Icon icon="solar:check-circle-bold" width={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{stats.approved}</p>
                <p className="text-[11px] text-gray-500">Aprobadas</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-amber-300 transition-colors" onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <Icon icon="solar:clock-circle-bold" width={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-[11px] text-gray-500">En revisión</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-red-300 transition-colors" onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? '' : 'REJECTED')}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <Icon icon="solar:close-circle-bold" width={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{stats.rejected}</p>
                <p className="text-[11px] text-gray-500">Rechazadas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
        <Icon icon="solar:info-circle-bold" width={20} className="text-blue-500 flex-shrink-0" />
        <div className="text-xs text-blue-700 dark:text-blue-400">
          <span className="font-medium">Directrices Meta:</span> Las plantillas son revisadas por Meta antes de poder usarse. El proceso toma de minutos a 24h.
          Las variables usan formato <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{{nombre_variable}}'}</code> (minúsculas, guiones bajos).
          Solo las plantillas aprobadas pueden enviarse fuera de la ventana de 24h.
        </div>
      </div>

      {/* Filter indicator */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Filtrando por:</span>
          {getStatusBadge(statusFilter)}
          <button onClick={() => setStatusFilter('')} className="text-xs text-blue-500 hover:underline">Limpiar filtro</button>
        </div>
      )}

      {/* Templates Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="xl" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:document-text-bold-duotone" width={32} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              {statusFilter ? 'Sin plantillas con este estado' : 'Sin plantillas'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {statusFilter ? 'Prueba con otro filtro' : 'Crea tu primera plantilla para enviar mensajes fuera de la ventana de 24h'}
            </p>
            {!statusFilter && (
              <Button color="primary" size="sm" className="mt-4 mx-auto" onClick={() => { resetForm(); setShowCreateModal(true); }}>
                <Icon icon="solar:add-circle-bold" className="mr-1.5" width={16} />
                Crear plantilla
              </Button>
            )}
          </div>
        ) : (
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Plantilla</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Categoría</Table.HeadCell>
              <Table.HeadCell>Idioma</Table.HeadCell>
              <Table.HeadCell>Calidad</Table.HeadCell>
              <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {templates.map((template) => (
                <Table.Row key={template.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm font-mono">{template.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {template.parsed.body || '—'}
                      </p>
                      {template.parsed.buttons.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {template.parsed.buttons.map((btn, i) => (
                            <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              {btn.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{getStatusBadge(template.status)}</Table.Cell>
                  <Table.Cell>{getCategoryBadge(template.category)}</Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-gray-500">{getLanguageLabel(template.language)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    {template.quality_score?.score ? (
                      <Badge color={template.quality_score.score === 'GREEN' ? 'success' : template.quality_score.score === 'YELLOW' ? 'warning' : 'failure'} size="sm">
                        {template.quality_score.score === 'GREEN' ? 'Alta' : template.quality_score.score === 'YELLOW' ? 'Media' : 'Baja'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1.5">
                      <Tooltip content="Vista previa" trigger="hover">
                        <Button size="xs" color="light" onClick={() => { setSelectedTemplate(template); setShowPreviewModal(true); }}>
                          <Icon icon="solar:eye-bold" width={14} className="text-blue-500" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Eliminar" trigger="hover">
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => handleDelete(template.name)}
                          disabled={deleting === template.name}
                        >
                          {deleting === template.name
                            ? <Spinner size="xs" />
                            : <Icon icon="solar:trash-bin-trash-bold" width={14} className="text-red-500" />
                          }
                        </Button>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* ========== CREATE TEMPLATE MODAL ========== */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:document-add-bold" width={22} className="text-blue-500" />
            <span>Nueva plantilla de mensaje</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-5">
            {/* Name + Category + Language */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="reactivacion_cliente"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Solo minúsculas, números y _</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utilidad</option>
                  <option value="AUTHENTICATION">Autenticación</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Idioma</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="en_US">English (US)</option>
                  <option value="pt_BR">Português (BR)</option>
                </select>
              </div>
            </div>

            {/* Header */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Encabezado (opcional)</label>
              <div className="flex gap-2 mb-2">
                {(['NONE', 'TEXT'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setForm(f => ({ ...f, header_type: type }))}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      form.header_type === type
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {type === 'NONE' ? 'Sin encabezado' : 'Texto'}
                  </button>
                ))}
              </div>
              {form.header_type === 'TEXT' && (
                <input
                  type="text"
                  value={form.header_text}
                  onChange={(e) => setForm(f => ({ ...f, header_text: e.target.value }))}
                  placeholder="Título del mensaje"
                  maxLength={60}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                />
              )}
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Cuerpo del mensaje <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder={"¡Hola {{customer_name}}! 👋\n\nHace tiempo que no sabemos de ti. ¿Podemos ayudarte en algo?"}
                rows={5}
                className="text-sm"
              />
              <div className="flex justify-between mt-1">
                <p className="text-[10px] text-gray-400">
                  Variables: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{{nombre_variable}}'}</code> — minúsculas y guiones bajos
                </p>
                <span className="text-[10px] text-gray-400">{form.body.length}/1024</span>
              </div>
            </div>

            {/* Example values for variables */}
            {extractVariables(form.body).length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Valores de ejemplo (requeridos por Meta para revisión)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {extractVariables(form.body).map((varName, i) => (
                    <div key={varName} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-500 whitespace-nowrap">{`{{${varName}}}`}</span>
                      <input
                        type="text"
                        value={form.example_body_params[i] || ''}
                        onChange={(e) => {
                          const newParams = [...form.example_body_params];
                          newParams[i] = e.target.value;
                          setForm(f => ({ ...f, example_body_params: newParams }));
                        }}
                        placeholder={`Ej: ${varName === 'customer_name' ? 'Juan' : varName}`}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pie de mensaje (opcional)</label>
              <input
                type="text"
                value={form.footer}
                onChange={(e) => setForm(f => ({ ...f, footer: e.target.value }))}
                placeholder="Responde STOP para dejar de recibir mensajes"
                maxLength={60}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Botones (opcional, máx. 3)</label>
                {form.buttons.length < 3 && (
                  <button onClick={addButton} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                    <Icon icon="solar:add-circle-bold" width={14} />
                    Agregar botón
                  </button>
                )}
              </div>
              {form.buttons.map((btn, i) => (
                <div key={i} className="flex items-start gap-2 mb-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <select
                      value={btn.type}
                      onChange={(e) => updateButton(i, 'type', e.target.value)}
                      className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="QUICK_REPLY">Respuesta rápida</option>
                      <option value="URL">URL</option>
                      <option value="PHONE_NUMBER">Teléfono</option>
                    </select>
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => updateButton(i, 'text', e.target.value)}
                      placeholder="Texto del botón"
                      maxLength={25}
                      className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                    {btn.type === 'URL' && (
                      <input
                        type="url"
                        value={btn.url}
                        onChange={(e) => updateButton(i, 'url', e.target.value)}
                        placeholder="https://ejemplo.com"
                        className="col-span-2 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    )}
                    {btn.type === 'PHONE_NUMBER' && (
                      <input
                        type="text"
                        value={btn.phone_number}
                        onChange={(e) => updateButton(i, 'phone_number', e.target.value)}
                        placeholder="+573001234567"
                        className="col-span-2 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    )}
                  </div>
                  <button onClick={() => removeButton(i)} className="p-1 text-red-400 hover:text-red-600">
                    <Icon icon="solar:close-circle-bold" width={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Live Preview */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Vista previa</label>
              <div className="bg-[#e5ddd5] dark:bg-gray-900 rounded-xl p-4">
                <div className="max-w-xs bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 space-y-1.5">
                  {form.header_type === 'TEXT' && form.header_text && (
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{form.header_text}</p>
                  )}
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {renderBodyPreview(form.body || 'Escribe el cuerpo del mensaje...')}
                  </p>
                  {form.footer && (
                    <p className="text-[11px] text-gray-400">{form.footer}</p>
                  )}
                  {form.buttons.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
                      {form.buttons.map((btn, i) => (
                        <div key={i} className="text-center py-1.5 text-sm text-blue-500 font-medium border border-blue-100 dark:border-blue-900 rounded-lg">
                          {btn.type === 'URL' && <Icon icon="solar:link-bold" width={12} className="inline mr-1" />}
                          {btn.type === 'PHONE_NUMBER' && <Icon icon="solar:phone-bold" width={12} className="inline mr-1" />}
                          {btn.text || 'Botón'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-between w-full">
            <p className="text-[10px] text-gray-400 self-center">
              La plantilla será enviada a Meta para revisión (minutos a 24h)
            </p>
            <div className="flex gap-2">
              <Button color="gray" size="sm" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button color="primary" size="sm" onClick={handleCreate} disabled={creating || !form.name || !form.body}>
                {creating ? <Spinner size="sm" className="mr-1.5" /> : <Icon icon="solar:plain-bold" className="mr-1.5" width={16} />}
                Enviar a revisión
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ========== PREVIEW MODAL ========== */}
      <Modal show={showPreviewModal} onClose={() => setShowPreviewModal(false)} size="md">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:eye-bold" width={20} className="text-blue-500" />
            <span className="font-mono text-sm">{selectedTemplate?.name}</span>
            {selectedTemplate && getStatusBadge(selectedTemplate.status)}
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedTemplate && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Icon icon="solar:tag-bold" width={12} />
                  {getCategoryBadge(selectedTemplate.category)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon icon="solar:global-bold" width={12} />
                  {getLanguageLabel(selectedTemplate.language)}
                </span>
                {selectedTemplate.quality_score?.score && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:star-bold" width={12} />
                    Calidad: {selectedTemplate.quality_score.score}
                  </span>
                )}
              </div>

              {/* Rejected reason */}
              {selectedTemplate.status === 'REJECTED' && selectedTemplate.rejected_reason && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                  <Icon icon="solar:danger-triangle-bold" width={16} className="text-red-500" />
                  <span className="text-xs text-red-700 dark:text-red-400">
                    Razón de rechazo: {selectedTemplate.rejected_reason}
                  </span>
                </div>
              )}

              {/* WhatsApp-style preview */}
              <div className="bg-[#e5ddd5] dark:bg-gray-900 rounded-xl p-4">
                <div className="max-w-xs bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 space-y-1.5">
                  {selectedTemplate.parsed.header?.text && (
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{selectedTemplate.parsed.header.text}</p>
                  )}
                  {selectedTemplate.parsed.header?.format && selectedTemplate.parsed.header.format !== 'TEXT' && (
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                      <Icon icon={selectedTemplate.parsed.header.format === 'IMAGE' ? 'solar:gallery-bold' : selectedTemplate.parsed.header.format === 'VIDEO' ? 'solar:video-frame-bold' : 'solar:document-bold'} width={24} className="text-gray-400 mx-auto" />
                      <p className="text-[10px] text-gray-400 mt-1">{selectedTemplate.parsed.header.format}</p>
                    </div>
                  )}
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {renderBodyPreview(selectedTemplate.parsed.body)}
                  </p>
                  {selectedTemplate.parsed.footer && (
                    <p className="text-[11px] text-gray-400">{selectedTemplate.parsed.footer}</p>
                  )}
                  {selectedTemplate.parsed.buttons.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
                      {selectedTemplate.parsed.buttons.map((btn, i) => (
                        <div key={i} className="text-center py-1.5 text-sm text-blue-500 font-medium border border-blue-100 dark:border-blue-900 rounded-lg">
                          {btn.type === 'URL' && <Icon icon="solar:link-bold" width={12} className="inline mr-1" />}
                          {btn.type === 'PHONE_NUMBER' && <Icon icon="solar:phone-bold" width={12} className="inline mr-1" />}
                          {btn.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Template ID */}
              <p className="text-[10px] text-gray-400 font-mono">ID: {selectedTemplate.id}</p>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default WhatsAppPlantillas;

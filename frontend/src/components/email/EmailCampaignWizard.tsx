import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge, Tabs, TextInput, Textarea, TabsRef, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { sanitizeEmailHtml } from 'src/utils/sanitize';
import saasApi from 'src/services/saasApi';
import { emailCampaignService } from 'src/services/emailCampaignService';
import { campaignTemplateService, type CampaignTemplate } from 'src/services/campaignTemplateService';
import EmailDesigner from 'src/components/email/EmailDesigner';
import { createPortal } from 'react-dom';

interface EmailCampaignWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
  initialContent?: string;
}

const STEPS = [
  { id: 1, title: 'Información', icon: 'solar:document-text-bold', description: 'Nombre y asunto' },
  { id: 2, title: 'Contenido', icon: 'solar:palette-round-bold', description: 'Diseño del email' },
  { id: 3, title: 'Audiencia', icon: 'solar:users-group-two-rounded-bold', description: 'Seleccionar destinatarios' },
  { id: 4, title: 'Configuración', icon: 'solar:settings-bold', description: 'Opciones de envío' },
  { id: 5, title: 'Ejecutar', icon: 'solar:play-circle-bold', description: 'Lanzar campaña' }
];

export const EmailCampaignWizard: React.FC<EmailCampaignWizardProps> = ({ 
  onComplete, 
  onCancel,
  initialContent = ''
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const tabsRef = useRef<TabsRef>(null);

  // Paso 1: Información
  const [campName, setCampName] = useState('');
  const [campSubject, setCampSubject] = useState('');

  // Paso 2: Contenido
  const [contentMode, setContentMode] = useState<'manual' | 'template'>('manual');
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('html');
  const [campContent, setCampContent] = useState(initialContent);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Paso 3: Audiencia
  const [audienceMode, setAudienceMode] = useState<'all' | 'manual'>('all');
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Record<number, { id: number; name: string; email: string }>>({});
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsHasMore, setClientsHasMore] = useState(false);

  // Paso 4: Configuración
  const [campThrottling, setCampThrottling] = useState<number>(30);

  // Paso 5: Ejecución
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [executionStarted, setExecutionStarted] = useState(false);

  // Sincronizar tabs con currentStep
  useEffect(() => {
    if (tabsRef.current && currentStep > 0) {
      tabsRef.current.setActiveTab(currentStep - 1);
    }
  }, [currentStep]);

  // Cargar plantillas al montar
  useEffect(() => {
    loadTemplates();
  }, []);

  // Cargar clientes al cambiar a modo manual
  useEffect(() => {
    if (audienceMode === 'manual' && !clientLoading && clientResults.length === 0) {
      searchClients(1, false);
    }
  }, [audienceMode]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const resp = await campaignTemplateService.getTemplates({});
      if (resp?.success && Array.isArray(resp.data)) {
        setTemplates(resp.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = (template: CampaignTemplate) => {
    setSelectedTemplateId(template.id);
    setCampContent(template.content);
    if (!campSubject.trim() && template.name) {
      setCampSubject(template.name);
    }
  };

  // Variables disponibles para usar en el contenido
  const availableVariables = [
    { key: 'nombre', description: 'Nombre del cliente' },
    { key: 'apellidos', description: 'Apellidos del cliente' },
    { key: 'email', description: 'Email del cliente' },
    { key: 'email_principal', description: 'Email principal del cliente' },
    { key: 'numero_documento', description: 'Número de documento' },
    { key: 'celular_principal', description: 'Teléfono celular' },
    { key: 'ciudad', description: 'Ciudad del cliente' },
  ];

  const searchClients = async (page: number = 1, append: boolean = false) => {
    setClientLoading(true);
    try {
      const resp = await saasApi.getClientes({
        search: clientQuery || undefined,
        per_page: 10,
        page
      });
      const payload: any = resp?.data as any;
      const data = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      const mapped = data.map((c: any) => {
        const id = Number(c.id || c.cliente_id || 0);
        const first = c?.persona?.nombres ?? c?.nombres ?? c?.nombre ?? c?.empresa?.razon_social ?? '';
        const last = c?.persona?.apellidos ?? c?.apellidos ?? '';
        const name = String(`${first} ${last}` || '').trim();
        const email = String(c?.email_principal ?? c?.email ?? '').trim();
        return { id, name: name || `Cliente ${id}`, email };
      }).filter((r: any) => r.id > 0 && r.email && r.email.includes('@'));
      
      setClientResults(prev => append ? [...prev, ...mapped] : mapped);
      const current = Number(payload?.current_page || page || 1);
      const last = Number(payload?.last_page || current || 1);
      setClientsPage(current);
      setClientsHasMore(current < last);
    } catch (_e) {
      if (!append) setClientResults([]);
      setClientsHasMore(false);
    } finally {
      setClientLoading(false);
    }
  };

  const isStepComplete = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1: return !!campName.trim() && !!campSubject.trim();
      case 2: return !!campContent.trim();
      case 3: return audienceMode === 'all' || Object.keys(selectedClients).length > 0;
      case 4: return true;
      case 5: return isStepComplete(1) && isStepComplete(2) && isStepComplete(3);
      default: return false;
    }
  };

  const getValidationMessage = (stepNumber: number): string => {
    switch (stepNumber) {
      case 1: 
        if (!campName.trim()) return "Ingresa el nombre de la campaña";
        if (!campSubject.trim()) return "Ingresa el asunto del email";
        return "";
      case 2: 
        if (!campContent.trim()) return "Escribe el contenido del email";
        return "";
      case 3:
        if (audienceMode === 'manual' && Object.keys(selectedClients).length === 0) 
          return "Selecciona al menos un cliente";
        return "";
      default: return "";
    }
  };

  const handleExecuteCampaign = async () => {
    if (creatingCampaign || executionStarted) return;

    try {
      setCreatingCampaign(true);
      setWizardError(null);

      const selectedIds = Object.keys(selectedClients)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n) && n > 0);

      const segmentFilters = audienceMode === 'manual' ? { cliente_ids: selectedIds } : {};

      const payload: any = {
        name: campName.trim(),
        subject: campSubject.trim(),
        content: campContent,
        audience_type: 'segment',
        segment_filters: segmentFilters,
        throttling_per_minute: campThrottling || 30,
      };

      const createResp = await emailCampaignService.createCampaign(payload);
      if (!createResp?.success || !createResp?.data?.id) {
        throw new Error(createResp?.message || 'No se pudo crear la campaña');
      }
      
      const campaignId = createResp.data.id;
      const startResp = await emailCampaignService.startCampaign(campaignId);
      if (!startResp?.success) {
        throw new Error(startResp?.message || 'No se pudo iniciar la campaña');
      }

      setExecutionStarted(true);
      
      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      setWizardError(err?.message || 'Error al crear o iniciar la campaña');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const nextStep = () => {
    if (isStepComplete(currentStep)) {
      const newStep = Math.min(currentStep + 1, STEPS.length);
      setCurrentStep(newStep);
    }
  };

  const prevStep = () => {
    const newStep = Math.max(currentStep - 1, 1);
    setCurrentStep(newStep);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] bg-black/60"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh'
      } as React.CSSProperties}
    >
      <div className="w-full h-full p-0 flex items-center justify-center relative z-[9999]">
        <div
          className="w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="guro-modal-header flex-shrink-0 p-6">
            <div className="flex items-center justify-between relative z-[1]">
              <div>
                <h2 className="text-xl font-bold text-white drop-shadow-sm">Crear Campaña de Email</h2>
                <p className="text-white/60 text-sm mt-1">
                  Configura tu campaña de email marketing
                </p>
              </div>
              <div className="flex items-center gap-3 relative z-[1]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span className="text-sm text-white/70">
                    Paso {currentStep} de {STEPS.length}
                  </span>
                </div>
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl transition-colors"
                  >
                    <Icon icon="solar:close-circle-outline" className="w-4 h-4" />
                    Cancelar
                  </button>
                )}
              </div>
            </div>
            
            {/* Barra de progreso */}
            <div className="mt-4 relative z-[1]">
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div 
                  className="bg-white h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Contenido con Tabs */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto">
              <Tabs 
                ref={tabsRef}
                aria-label="Email campaign wizard" 
                variant="underline"
                onActiveTabChange={(tab) => {
                  const targetStep = tab + 1;
                  if (targetStep === currentStep || 
                      targetStep < currentStep || 
                      (targetStep === currentStep + 1 && isStepComplete(currentStep))) {
                    setCurrentStep(targetStep);
                  } else {
                    if (tabsRef.current) {
                      tabsRef.current.setActiveTab(currentStep - 1);
                    }
                  }
                }}
              >
                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id || isStepComplete(step.id);
                  const isAccessible = step.id <= currentStep || isStepComplete(step.id - 1);
                  
                  return (
                    <Tabs.Item
                      key={step.id}
                      active={isActive}
                      title={step.title}
                      disabled={!isAccessible}
                      icon={() => (
                        <div className="flex items-center gap-2">
                          {isCompleted && currentStep > step.id ? (
                            <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
                          ) : (
                            <Icon icon={step.icon} className={`w-5 h-5 ${!isAccessible ? 'text-gray-400' : ''}`} />
                          )}
                        </div>
                      )}
                    >
                      <div className="mt-6 pb-6">
                        {/* Paso 1: Información */}
                        {isActive && step.id === 1 && (
                          <div className="max-w-2xl mx-auto space-y-6">
                            <Card>
                              <div className="p-6 space-y-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2">Nombre de la campaña</label>
                                  <TextInput
                                    placeholder="Ej: Renovaciones Octubre 2025"
                                    value={campName}
                                    onChange={(e) => setCampName(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-2">Asunto del email</label>
                                  <TextInput
                                    placeholder="Ej: ¡Renueva tu póliza este mes!"
                                    value={campSubject}
                                    onChange={(e) => setCampSubject(e.target.value)}
                                  />
                                </div>
                              </div>
                            </Card>
                          </div>
                        )}

                        {/* Paso 2: Contenido */}
                        {isActive && step.id === 2 && (
                          <div className="space-y-6">
                            {/* Selector de modo */}
                            <div className="flex gap-3 justify-center">
                              <Button
                                size="sm"
                                color={contentMode === 'manual' ? 'primary' : 'gray'}
                                onClick={() => setContentMode('manual')}
                              >
                                <Icon icon="solar:code-bold" className="mr-2" width={16} />
                                Escribir contenido
                              </Button>
                              <Button
                                size="sm"
                                color={contentMode === 'template' ? 'primary' : 'gray'}
                                onClick={() => setContentMode('template')}
                              >
                                <Icon icon="solar:document-text-bold" className="mr-2" width={16} />
                                Usar plantilla
                              </Button>
                            </div>

                            {contentMode === 'template' ? (
                              <div className="space-y-6">
                                {/* Lista de plantillas */}
                                <Card>
                                  <div className="p-6">
                                    <h4 className="text-lg font-semibold mb-4">Seleccionar Plantilla</h4>
                                    {loadingTemplates ? (
                                      <div className="text-center py-8">
                                        <Icon icon="solar:refresh-circle-outline" className="w-8 h-8 animate-spin mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">Cargando plantillas...</p>
                                      </div>
                                    ) : templates.length === 0 ? (
                                      <div className="text-center py-8">
                                        <Icon icon="solar:document-text-bold" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">No hay plantillas disponibles</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                                        {templates.map((tpl) => (
                                          <div
                                            key={tpl.id}
                                            onClick={() => handleTemplateSelect(tpl)}
                                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                              selectedTemplateId === tpl.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <h5 className="font-semibold text-sm">{tpl.name}</h5>
                                              {selectedTemplateId === tpl.id && (
                                                <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-blue-600" />
                                              )}
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2">
                                              {tpl.category_name || tpl.category}
                                            </p>
                                            <div className="mt-2 flex gap-1 flex-wrap">
                                              {(tpl.variables_list || Object.keys(tpl.variables || {})).slice(0, 3).map((v, i) => (
                                                <Badge key={i} color="info" size="xs">{`{{${v}}}`}</Badge>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </Card>

                                {/* Vista previa - Abajo del selector */}
                                {campContent && (
                                  <Card>
                                    <div className="p-6">
                                      <h4 className="text-lg font-semibold mb-4">Vista Previa del Contenido</h4>
                                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                                        <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(campContent) }} />
                                      </div>
                                    </div>
                                  </Card>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Selector de modo de edición */}
                                <div className="flex gap-3 justify-center">
                                  <Button
                                    size="sm"
                                    color={editorMode === 'visual' ? 'primary' : 'gray'}
                                    onClick={() => setEditorMode('visual')}
                                  >
                                    <Icon icon="solar:palette-round-bold" className="mr-2" width={16} />
                                    Editor Visual
                                  </Button>
                                  <Button
                                    size="sm"
                                    color={editorMode === 'html' ? 'primary' : 'gray'}
                                    onClick={() => setEditorMode('html')}
                                  >
                                    <Icon icon="solar:code-bold" className="mr-2" width={16} />
                                    HTML Puro
                                  </Button>
                                </div>

                                {editorMode === 'visual' ? (
                                  <Card>
                                    <div className="p-6">
                                      <h4 className="text-lg font-semibold mb-4">Editor Visual</h4>
                                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                        <EmailDesigner
                                          initialHtml={campContent || undefined}
                                          height={500}
                                          onChange={(html) => setCampContent(html)}
                                          className="w-full"
                                        />
                                      </div>
                                    </div>
                                  </Card>
                                ) : (
                                  <Card>
                                    <div className="p-6 space-y-4">
                                      <div>
                                        <label className="block text-sm font-medium mb-2">Contenido del email (HTML)</label>
                                        <Textarea
                                          rows={12}
                                          placeholder="Escribe el contenido del email. Puedes usar variables como {{nombre}}, {{email}}, {{numero_documento}}..."
                                          value={campContent}
                                          onChange={(e) => setCampContent(e.target.value)}
                                        />
                                      </div>

                                      {/* Variables disponibles */}
                                      <Alert color="info">
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Icon icon="solar:code-bold" width={16} />
                                            <span className="font-semibold text-sm">Variables disponibles:</span>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                            {availableVariables.map((v) => (
                                              <div key={v.key} className="flex items-center gap-1">
                                                <code className="bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-300">
                                                  {'{'}{'{'}{v.key}{'}'}{'}'}
                                                </code>
                                                <span className="text-gray-600 dark:text-gray-400 truncate">- {v.description}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                            Ejemplo: Hola {'{'}{'{'} nombre {'}'}{'}'},  tu email es {'{'}{'{'} email {'}'}{'}'}
                                          </p>
                                        </div>
                                      </Alert>
                                    </div>
                                  </Card>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Paso 3: Audiencia */}
                        {isActive && step.id === 3 && (
                          <div className="space-y-6">
                            <Card>
                              <div className="p-6">
                                <div className="flex gap-3 mb-4">
                                  <Button
                                    size="sm"
                                    color={audienceMode === 'all' ? 'primary' : 'gray'}
                                    onClick={() => setAudienceMode('all')}
                                  >
                                    <Icon icon="solar:users-group-two-rounded-bold" className="mr-2" width={16} />
                                    Todos los clientes
                                  </Button>
                                  <Button
                                    size="sm"
                                    color={audienceMode === 'manual' ? 'primary' : 'gray'}
                                    onClick={() => setAudienceMode('manual')}
                                  >
                                    <Icon icon="solar:user-check-rounded-bold" className="mr-2" width={16} />
                                    Seleccionar manualmente
                                  </Button>
                                </div>

                                {audienceMode === 'all' ? (
                                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <Icon icon="solar:users-group-two-rounded-bold" className="mr-2 inline" width={20} />
                                    <span>Se enviará a TODOS los clientes del sistema con email válido</span>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex gap-2">
                                      <TextInput
                                        placeholder="Buscar clientes..."
                                        value={clientQuery}
                                        onChange={(e) => setClientQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') searchClients(1, false);
                                        }}
                                        className="flex-1"
                                      />
                                      <Button size="sm" color="gray" onClick={() => searchClients(1, false)}>
                                        <Icon icon="solar:magnifer-bold" width={16} />
                                      </Button>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-600">
                                      <span>Seleccionados: <strong>{Object.keys(selectedClients).length}</strong></span>
                                      <div className="flex gap-2">
                                        <Button
                                          size="xs"
                                          color="success"
                                          onClick={() => {
                                            setSelectedClients((prev) => {
                                              const next = { ...prev };
                                              clientResults.forEach((r) => { next[r.id] = r; });
                                              return next;
                                            });
                                          }}
                                        >
                                          Seleccionar todos
                                        </Button>
                                        <Button
                                          size="xs"
                                          color="failure"
                                          onClick={() => setSelectedClients({})}
                                        >
                                          Limpiar
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-60 overflow-y-auto">
                                      {clientLoading ? (
                                        <Badge color="info">Buscando clientes...</Badge>
                                      ) : clientResults.length === 0 ? (
                                        <p className="text-xs text-gray-500">Sin resultados</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {clientResults.map((r) => (
                                            <div key={r.id} className="flex items-center gap-3">
                                              <input
                                                type="checkbox"
                                                checked={!!selectedClients[r.id]}
                                                onChange={(e) => {
                                                  const checked = e.target.checked;
                                                  setSelectedClients((prev) => {
                                                    const next = { ...prev };
                                                    if (checked) next[r.id] = r;
                                                    else delete next[r.id];
                                                    return next;
                                                  });
                                                }}
                                              />
                                              <div className="text-sm flex-1">
                                                <div className="font-medium">{r.name}</div>
                                                <div className="text-xs text-gray-500">{r.email}</div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </Card>
                          </div>
                        )}

                        {/* Paso 4: Configuración */}
                        {isActive && step.id === 4 && (
                          <div className="max-w-2xl mx-auto">
                            <Card>
                              <div className="p-6">
                                <div>
                                  <label className="block text-sm font-medium mb-2">Throttling (emails/minuto)</label>
                                  <TextInput
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={campThrottling}
                                    onChange={(e) => setCampThrottling(Math.max(1, Math.min(120, Number(e.target.value) || 30)))}
                                  />
                                  <p className="mt-1 text-xs text-gray-500">Valor recomendado: 30 emails por minuto</p>
                                </div>
                              </div>
                            </Card>
                          </div>
                        )}

                        {/* Paso 5: Ejecutar */}
                        {isActive && step.id === 5 && (
                          <div className="space-y-6">
                            {executionStarted ? (
                              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                                <div className="p-8 text-center">
                                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon icon="solar:check-circle-bold" className="w-8 h-8 text-white" />
                                  </div>
                                  <h2 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">
                                    ¡Campaña Iniciada!
                                  </h2>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    Los emails están siendo enviados
                                  </p>
                                </div>
                              </Card>
                            ) : (
                              <Card className="bg-primary/5 border-primary/20">
                                <div className="p-6 text-center">
                                  <Icon icon="solar:rocket-outline" className="w-16 h-16 text-primary mx-auto mb-4" />
                                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    Campaña Lista para Ejecutar
                                  </h3>
                                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Se enviarán emails a {audienceMode === 'all' ? 'todos los clientes' : `${Object.keys(selectedClients).length} clientes seleccionados`}
                                  </p>
                                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                                      <div className="text-xs text-gray-500">Asunto</div>
                                      <div className="text-sm font-semibold truncate">{campSubject}</div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                                      <div className="text-xs text-gray-500">Audiencia</div>
                                      <div className="text-sm font-semibold">
                                        {audienceMode === 'all' ? 'Todos' : Object.keys(selectedClients).length}
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                                      <div className="text-xs text-gray-500">Velocidad</div>
                                      <div className="text-sm font-semibold">{campThrottling}/min</div>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            )}

                            {wizardError && (
                              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                                <div className="p-4">
                                  <Icon icon="solar:danger-triangle-bold" className="mr-2 inline" width={20} />
                                  <span className="text-red-800 dark:text-red-300">{wizardError}</span>
                                </div>
                              </Card>
                            )}
                          </div>
                        )}
                      </div>
                    </Tabs.Item>
                  );
                })}
              </Tabs>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center">
              <Button
                onClick={prevStep}
                disabled={currentStep === 1}
                color="gray"
                size="sm"
              >
                <Icon icon="solar:arrow-left-outline" className="w-4 h-4 mr-2" />
                Anterior
              </Button>

              <div className="flex flex-col items-end gap-2">
                {!isStepComplete(currentStep) && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full">
                    <Icon icon="solar:info-circle-outline" className="w-3 h-3 inline mr-1" />
                    {getValidationMessage(currentStep)}
                  </div>
                )}
                
                <div className="flex gap-2">
                  {currentStep < STEPS.length ? (
                    <Button
                      onClick={nextStep}
                      disabled={!isStepComplete(currentStep)}
                      color="primary"
                      size="sm"
                    >
                      Siguiente
                      <Icon icon="solar:arrow-right-outline" className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleExecuteCampaign}
                      disabled={!isStepComplete(currentStep) || creatingCampaign || executionStarted}
                      color="success"
                      size="sm"
                    >
                      {creatingCampaign ? (
                        <>
                          <Icon icon="solar:refresh-circle-outline" className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Icon icon="solar:rocket-outline" className="w-4 h-4 mr-2" />
                          Crear y Enviar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EmailCampaignWizard;
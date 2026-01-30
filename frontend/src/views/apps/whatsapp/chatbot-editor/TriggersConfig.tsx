import React, { useState, useEffect } from 'react';
import { Card, Button, TextInput, Select, Badge, Modal, Textarea, ToggleSwitch } from 'flowbite-react';
import { Icon } from '@iconify/react';
import chatbotService, { ChatbotTrigger, ChatbotFlow } from 'src/services/chatbotService';

interface TriggersConfigProps {
  chatbotId: number;
  flows: ChatbotFlow[];
  onUpdate?: () => void;
}

const triggerTypes = [
  { value: 'keyword', label: 'Palabra clave', icon: 'solar:text-bold', description: 'Se activa cuando el mensaje contiene una palabra exacta' },
  { value: 'contains', label: 'Contiene texto', icon: 'solar:text-selection-bold', description: 'Se activa cuando el mensaje contiene un texto' },
  { value: 'starts_with', label: 'Empieza con', icon: 'solar:text-italic-bold', description: 'Se activa cuando el mensaje empieza con un texto' },
  { value: 'regex', label: 'Expresión regular', icon: 'solar:code-bold', description: 'Se activa cuando el mensaje coincide con un patrón regex' },
  { value: 'first_message', label: 'Primer mensaje', icon: 'solar:user-plus-bold', description: 'Se activa con el primer mensaje de un contacto nuevo' },
  { value: 'media', label: 'Archivo multimedia', icon: 'solar:gallery-bold', description: 'Se activa cuando recibe imagen, video o documento' },
  { value: 'location', label: 'Ubicación', icon: 'solar:map-point-bold', description: 'Se activa cuando recibe una ubicación' },
  { value: 'schedule', label: 'Horario', icon: 'solar:clock-circle-bold', description: 'Se activa solo en ciertos horarios' },
];

const predefinedKeywords = [
  { label: 'Saludos', keywords: 'hola,buenos días,buenas tardes,buenas noches,hey,hi,hello' },
  { label: 'Ayuda', keywords: 'ayuda,help,información,info,menu,menú,opciones' },
  { label: 'Precios', keywords: 'precio,precios,costo,costos,cuánto,cuanto,tarifa,cotización' },
  { label: 'Horarios', keywords: 'horario,horarios,hora,abierto,cerrado,atienden' },
  { label: 'Ubicación', keywords: 'ubicación,dirección,donde,dónde,llegar,mapa' },
  { label: 'Agente humano', keywords: 'humano,persona,asesor,agente,operador' },
];

const TriggersConfig: React.FC<TriggersConfigProps> = ({ chatbotId, flows, onUpdate }) => {
  const [triggers, setTriggers] = useState<ChatbotTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<Partial<ChatbotTrigger> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTriggers();
  }, [chatbotId]);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      const result = await chatbotService.getTriggers(chatbotId);
      if (result.success && result.data) {
        setTriggers(result.data);
      }
    } catch (error) {
      console.error('Error cargando triggers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrigger = () => {
    setEditingTrigger({
      chatbot_id: chatbotId,
      flow_id: flows[0]?.id,
      trigger_type: 'keyword',
      trigger_value: '',
      is_case_sensitive: false,
      priority: 0,
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEditTrigger = (trigger: ChatbotTrigger) => {
    setEditingTrigger({ ...trigger });
    setShowModal(true);
  };

  const handleSaveTrigger = async () => {
    if (!editingTrigger) return;

    try {
      setSaving(true);
      
      if (editingTrigger.id) {
        await chatbotService.updateTrigger(editingTrigger.id, editingTrigger);
      } else {
        await chatbotService.createTrigger(chatbotId, editingTrigger);
      }
      
      setShowModal(false);
      setEditingTrigger(null);
      await loadTriggers();
      onUpdate?.();
    } catch (error) {
      console.error('Error guardando trigger:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrigger = async (triggerId: number) => {
    if (!confirm('¿Estás seguro de eliminar este trigger?')) return;
    
    try {
      await chatbotService.deleteTrigger(triggerId);
      await loadTriggers();
      onUpdate?.();
    } catch (error) {
      console.error('Error eliminando trigger:', error);
    }
  };

  const handleToggleActive = async (trigger: ChatbotTrigger) => {
    try {
      await chatbotService.updateTrigger(trigger.id, { is_active: !trigger.is_active });
      await loadTriggers();
    } catch (error) {
      console.error('Error actualizando trigger:', error);
    }
  };

  const applyPredefinedKeywords = (keywords: string) => {
    if (editingTrigger) {
      setEditingTrigger({ ...editingTrigger, trigger_value: keywords });
    }
  };

  const getTriggerTypeInfo = (type: string) => {
    return triggerTypes.find(t => t.value === type) || triggerTypes[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Icon icon="svg-spinners:ring-resize" className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Triggers (Disparadores)</h3>
          <p className="text-sm text-gray-500">Define cuándo se activa el chatbot</p>
        </div>
        <Button color="primary" size="sm" onClick={handleCreateTrigger}>
          <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
          Agregar Trigger
        </Button>
      </div>

      {triggers.length === 0 ? (
        <Card className="text-center py-8">
          <Icon icon="solar:bolt-circle-bold-duotone" className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">No hay triggers configurados</p>
          <p className="text-sm text-gray-400">Agrega un trigger para que el chatbot responda a mensajes</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => {
            const typeInfo = getTriggerTypeInfo(trigger.trigger_type);
            return (
              <Card key={trigger.id} className={`${!trigger.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${trigger.is_active ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Icon icon={typeInfo.icon} className={`w-5 h-5 ${trigger.is_active ? 'text-primary' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{typeInfo.label}</span>
                        <Badge color={trigger.is_active ? 'success' : 'gray'} size="sm">
                          {trigger.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {trigger.priority > 0 && (
                          <Badge color="info" size="sm">Prioridad: {trigger.priority}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {trigger.trigger_value ? (
                          <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">
                            {trigger.trigger_value.length > 50 
                              ? trigger.trigger_value.substring(0, 50) + '...' 
                              : trigger.trigger_value}
                          </span>
                        ) : (
                          <span className="italic">{typeInfo.description}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Flujo: {flows.find(f => f.id === trigger.flow_id)?.name || 'No asignado'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={trigger.is_active}
                      onChange={() => handleToggleActive(trigger)}
                    />
                    <Button color="light" size="xs" onClick={() => handleEditTrigger(trigger)}>
                      <Icon icon="solar:pen-bold" className="w-4 h-4" />
                    </Button>
                    <Button color="failure" size="xs" onClick={() => handleDeleteTrigger(trigger.id)}>
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de edición */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>
          {editingTrigger?.id ? 'Editar Trigger' : 'Nuevo Trigger'}
        </Modal.Header>
        <Modal.Body>
          {editingTrigger && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Trigger
                </label>
                <Select
                  value={editingTrigger.trigger_type}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, trigger_type: e.target.value as any })}
                >
                  {triggerTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {getTriggerTypeInfo(editingTrigger.trigger_type || 'keyword').description}
                </p>
              </div>

              {['keyword', 'contains', 'starts_with', 'regex'].includes(editingTrigger.trigger_type || '') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {editingTrigger.trigger_type === 'keyword' ? 'Palabras clave (separadas por coma)' : 
                       editingTrigger.trigger_type === 'regex' ? 'Expresión regular' : 'Texto a buscar'}
                    </label>
                    <Textarea
                      value={editingTrigger.trigger_value || ''}
                      onChange={(e) => setEditingTrigger({ ...editingTrigger, trigger_value: e.target.value })}
                      placeholder={editingTrigger.trigger_type === 'keyword' ? 'hola, buenos días, hey' : 'Escribe el texto...'}
                      rows={3}
                    />
                  </div>

                  {editingTrigger.trigger_type === 'keyword' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Plantillas predefinidas
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {predefinedKeywords.map((preset) => (
                          <Button
                            key={preset.label}
                            color="light"
                            size="xs"
                            onClick={() => applyPredefinedKeywords(preset.keywords)}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={editingTrigger.is_case_sensitive || false}
                      onChange={(checked) => setEditingTrigger({ ...editingTrigger, is_case_sensitive: checked })}
                      label="Distinguir mayúsculas/minúsculas"
                    />
                  </div>
                </>
              )}

              {editingTrigger.trigger_type === 'schedule' && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <Icon icon="solar:info-circle-bold" className="w-4 h-4 inline mr-1" />
                    La configuración de horarios estará disponible próximamente.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Flujo a ejecutar
                </label>
                <Select
                  value={editingTrigger.flow_id || ''}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, flow_id: parseInt(e.target.value) })}
                >
                  <option value="">Selecciona un flujo</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>{flow.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prioridad (mayor número = mayor prioridad)
                </label>
                <TextInput
                  type="number"
                  value={editingTrigger.priority || 0}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, priority: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si varios triggers coinciden, se ejecutará el de mayor prioridad
                </p>
              </div>

              <div className="flex items-center gap-2">
                <ToggleSwitch
                  checked={editingTrigger.is_active !== false}
                  onChange={(checked) => setEditingTrigger({ ...editingTrigger, is_active: checked })}
                  label="Trigger activo"
                />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleSaveTrigger} disabled={saving}>
            {saving ? (
              <>
                <Icon icon="svg-spinners:ring-resize" className="w-4 h-4 mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TriggersConfig;

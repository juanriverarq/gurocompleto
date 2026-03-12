import React, { useState, useEffect } from 'react';
import { Button, TextInput, Textarea, Select, ToggleSwitch, Tabs } from 'flowbite-react';
import { Icon } from '@iconify/react';
import chatbotService, { Chatbot } from 'src/services/chatbotService';
import whatsappInstanceService, { WhatsAppInstance } from 'src/services/whatsappInstanceService';

interface ChatbotSettingsProps {
  chatbot: Chatbot;
  onUpdate: (chatbot: Chatbot) => void;
}

const ChatbotSettings: React.FC<ChatbotSettingsProps> = ({ chatbot, onUpdate }) => {
  const [settings, setSettings] = useState<Partial<Chatbot>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);

  useEffect(() => {
    whatsappInstanceService.getInstances().then(res => {
      if (res.success && res.data) setInstances(res.data);
    });
  }, []);

  useEffect(() => {
    setSettings({
      name: chatbot.name,
      description: chatbot.description,
      instance_id: chatbot.instance_id,
      welcome_message: chatbot.welcome_message,
      fallback_message: chatbot.fallback_message,
      goodbye_message: chatbot.goodbye_message,
      out_of_hours_message: chatbot.out_of_hours_message,
      typing_delay_ms: chatbot.typing_delay_ms,
      response_delay_ms: chatbot.response_delay_ms,
      session_timeout_minutes: chatbot.session_timeout_minutes,
      max_fallback_count: chatbot.max_fallback_count,
      ai_enabled: chatbot.ai_enabled,
      ai_provider: chatbot.ai_provider,
      ai_model: chatbot.ai_model,
      ai_system_prompt: chatbot.ai_system_prompt,
      ai_temperature: chatbot.ai_temperature,
      ai_max_tokens: chatbot.ai_max_tokens,
      business_hours_enabled: chatbot.business_hours_enabled,
      business_hours: chatbot.business_hours,
      timezone: chatbot.timezone,
      client_inactivity_enabled: chatbot.client_inactivity_enabled,
      client_inactivity_minutes: chatbot.client_inactivity_minutes,
      client_inactivity_message: chatbot.client_inactivity_message,
      agent_inactivity_enabled: chatbot.agent_inactivity_enabled,
      agent_inactivity_minutes: chatbot.agent_inactivity_minutes,
      agent_inactivity_message: chatbot.agent_inactivity_message,
      escape_enabled: chatbot.escape_enabled,
      escape_keywords: chatbot.escape_keywords,
      escape_message: chatbot.escape_message,
    });
  }, [chatbot]);

  const handleChange = (key: keyof Chatbot, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await chatbotService.updateChatbot(chatbot.id, settings);
      if (result.success && result.data) {
        onUpdate(result.data);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs aria-label="Configuración del chatbot" variant="underline">
        {/* Tab: General */}
        <Tabs.Item active title="General" icon={() => <Icon icon="solar:settings-bold" className="w-4 h-4 mr-2" />}>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del chatbot
              </label>
              <TextInput
                value={settings.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Mi Chatbot"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <Textarea
                value={settings.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe el propósito de este chatbot..."
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Icon icon="logos:whatsapp-icon" className="w-4 h-4 inline mr-1" />
                Conexión WhatsApp
              </label>
              <Select
                value={settings.instance_id || ''}
                onChange={(e) => handleChange('instance_id', e.target.value || null)}
              >
                <option value="">Sin asignar (todas las conexiones)</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.instance_id}>
                    {inst.phone_number || inst.instance_id}
                    {inst.connection_type === 'cloud_api' ? ' (Cloud API)' : ''}
                    {inst.status === 'connected' ? ' ✓' : ''}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Línea de WhatsApp donde operará este chatbot. Cámbiala si migraste a otra conexión.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Zona horaria
              </label>
              <Select
                value={settings.timezone || 'America/Bogota'}
                onChange={(e) => handleChange('timezone', e.target.value)}
              >
                <option value="America/Bogota">Colombia (Bogotá)</option>
                <option value="America/Mexico_City">México (Ciudad de México)</option>
                <option value="America/Lima">Perú (Lima)</option>
                <option value="America/Santiago">Chile (Santiago)</option>
                <option value="America/Buenos_Aires">Argentina (Buenos Aires)</option>
                <option value="America/New_York">USA (Nueva York)</option>
                <option value="Europe/Madrid">España (Madrid)</option>
              </Select>
            </div>
          </div>
        </Tabs.Item>

        {/* Tab: Mensajes */}
        <Tabs.Item title="Mensajes" icon={() => <Icon icon="solar:chat-round-dots-bold" className="w-4 h-4 mr-2" />}>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Icon icon="solar:hand-shake-bold" className="w-4 h-4 inline mr-1" />
                Mensaje de bienvenida
              </label>
              <Textarea
                value={settings.welcome_message || ''}
                onChange={(e) => handleChange('welcome_message', e.target.value)}
                placeholder="¡Hola! 👋 Soy un asistente virtual..."
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Se envía automáticamente cuando un usuario inicia una conversación
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Icon icon="solar:question-circle-bold" className="w-4 h-4 inline mr-1" />
                Mensaje de fallback
              </label>
              <Textarea
                value={settings.fallback_message || ''}
                onChange={(e) => handleChange('fallback_message', e.target.value)}
                placeholder="Lo siento, no entendí tu mensaje..."
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Se envía cuando el chatbot no entiende el mensaje del usuario
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Icon icon="solar:hand-stars-bold" className="w-4 h-4 inline mr-1" />
                Mensaje de despedida
              </label>
              <Textarea
                value={settings.goodbye_message || ''}
                onChange={(e) => handleChange('goodbye_message', e.target.value)}
                placeholder="¡Gracias por contactarnos! Hasta pronto 👋"
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Se envía al finalizar la conversación
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Icon icon="solar:moon-bold" className="w-4 h-4 inline mr-1" />
                Mensaje fuera de horario
              </label>
              <Textarea
                value={settings.out_of_hours_message || ''}
                onChange={(e) => handleChange('out_of_hours_message', e.target.value)}
                placeholder="Gracias por escribirnos. Nuestro horario de atención es..."
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Se envía cuando el usuario escribe fuera del horario de atención
              </p>
            </div>
          </div>
        </Tabs.Item>

        {/* Tab: Comportamiento */}
        <Tabs.Item title="Comportamiento" icon={() => <Icon icon="solar:tuning-2-bold" className="w-4 h-4 mr-2" />}>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Delay de escritura (ms)
                </label>
                <TextInput
                  type="number"
                  value={settings.typing_delay_ms || 1500}
                  onChange={(e) => handleChange('typing_delay_ms', parseInt(e.target.value))}
                  min={0}
                  max={10000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Simula que el bot está escribiendo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Delay de respuesta (ms)
                </label>
                <TextInput
                  type="number"
                  value={settings.response_delay_ms || 500}
                  onChange={(e) => handleChange('response_delay_ms', parseInt(e.target.value))}
                  min={0}
                  max={10000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Espera antes de responder
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Timeout de sesión (minutos)
                </label>
                <TextInput
                  type="number"
                  value={settings.session_timeout_minutes || 30}
                  onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value))}
                  min={1}
                  max={1440}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tiempo de inactividad para cerrar sesión
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Máximo de fallbacks
                </label>
                <TextInput
                  type="number"
                  value={settings.max_fallback_count || 3}
                  onChange={(e) => handleChange('max_fallback_count', parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Intentos antes de transferir a humano
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <ToggleSwitch
                checked={settings.business_hours_enabled || false}
                onChange={(checked) => handleChange('business_hours_enabled', checked)}
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Horario de atención</p>
                <p className="text-sm text-gray-500">Responder solo en horario de atención</p>
              </div>
            </div>

            {settings.business_hours_enabled && (() => {
              const days = [
                { key: 'monday', label: 'Lunes' },
                { key: 'tuesday', label: 'Martes' },
                { key: 'wednesday', label: 'Miércoles' },
                { key: 'thursday', label: 'Jueves' },
                { key: 'friday', label: 'Viernes' },
                { key: 'saturday', label: 'Sábado' },
                { key: 'sunday', label: 'Domingo' },
              ];
              const bh = settings.business_hours || {};
              const updateDay = (day: string, field: 'start' | 'end', value: string) => {
                const current = { ...(bh as any) };
                current[day] = { ...(current[day] || { start: '08:00', end: '18:00' }), [field]: value };
                handleChange('business_hours', current);
              };
              const toggleDay = (day: string) => {
                const current = { ...(bh as any) };
                if (current[day]) {
                  delete current[day];
                } else {
                  current[day] = { start: '08:00', end: '18:00' };
                }
                handleChange('business_hours', current);
              };
              return (
                <div className="space-y-2 mt-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Configurar horario por día</p>
                  {days.map(({ key, label }) => {
                    const dayData = (bh as any)[key];
                    const isActive = !!dayData;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <ToggleSwitch
                          checked={isActive}
                          onChange={() => toggleDay(key)}
                          sizing="sm"
                        />
                        <span className="w-24 text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        {isActive ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={dayData?.start || '08:00'}
                              onChange={(e) => updateDay(key, 'start', e.target.value)}
                              className="text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-2 py-1"
                            />
                            <span className="text-gray-400">a</span>
                            <input
                              type="time"
                              value={dayData?.end || '18:00'}
                              onChange={(e) => updateDay(key, 'end', e.target.value)}
                              className="text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-2 py-1"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Cerrado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Tabs.Item>

        {/* Tab: Automatización (Recordatorios de inactividad) */}
        <Tabs.Item title="Automatización" icon={() => <Icon icon="solar:alarm-bold" className="w-4 h-4 mr-2" />}>
          <div className="space-y-6 mt-4">
            {/* Recordatorio inactividad del cliente */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-4">
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  checked={settings.client_inactivity_enabled || false}
                  onChange={(checked) => handleChange('client_inactivity_enabled', checked)}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Recordatorio al cliente</p>
                  <p className="text-sm text-gray-500">Enviar mensaje si el cliente no responde en X minutos</p>
                </div>
              </div>

              {settings.client_inactivity_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tiempo de inactividad (minutos)
                    </label>
                    <TextInput
                      type="number"
                      value={settings.client_inactivity_minutes || 10}
                      onChange={(e) => handleChange('client_inactivity_minutes', parseInt(e.target.value))}
                      min={1}
                      max={1380}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se envía el recordatorio si el cliente lleva inactivo este tiempo. Máximo 23 horas (1380 min) por ventana de WhatsApp.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensaje de recordatorio
                    </label>
                    <Textarea
                      value={settings.client_inactivity_message || ''}
                      onChange={(e) => handleChange('client_inactivity_message', e.target.value)}
                      placeholder="Hola, notamos que no hemos recibido tu respuesta. ¿Podemos ayudarte en algo más?"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Solo se envía 1 vez por conversación. Se reinicia cuando el cliente responde.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Recordatorio inactividad del agente */}
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg space-y-4">
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  checked={settings.agent_inactivity_enabled || false}
                  onChange={(checked) => handleChange('agent_inactivity_enabled', checked)}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Recordatorio al agente</p>
                  <p className="text-sm text-gray-500">Enviar mensaje al cliente si el agente asignado no responde en X minutos</p>
                </div>
              </div>

              {settings.agent_inactivity_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tiempo de espera del agente (minutos)
                    </label>
                    <TextInput
                      type="number"
                      value={settings.agent_inactivity_minutes || 5}
                      onChange={(e) => handleChange('agent_inactivity_minutes', parseInt(e.target.value))}
                      min={1}
                      max={1380}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si el agente no responde en este tiempo, se envía un mensaje automático al cliente.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensaje de espera
                    </label>
                    <Textarea
                      value={settings.agent_inactivity_message || ''}
                      onChange={(e) => handleChange('agent_inactivity_message', e.target.value)}
                      placeholder="Gracias por tu paciencia. Un asesor te atenderá en breve."
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se envía al cliente cuando el agente asignado no ha respondido. Solo 1 vez por asignación.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Escape: Transferir a asesor cuando el usuario se atasca */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-4">
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  checked={settings.escape_enabled !== false}
                  onChange={(checked) => handleChange('escape_enabled', checked)}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Transferir a asesor si el cliente se atasca</p>
                  <p className="text-sm text-gray-500">Si el cliente escribe "asesor", "ayuda", etc. en cualquier paso del chatbot, se transfiere a un humano</p>
                </div>
              </div>

              {(settings.escape_enabled !== false) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Palabras clave (separadas por coma)
                    </label>
                    <TextInput
                      value={settings.escape_keywords || ''}
                      onChange={(e) => handleChange('escape_keywords', e.target.value)}
                      placeholder="asesor, ayuda, agente, humano, no puedo, no sé, operador"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si el mensaje del cliente contiene alguna de estas palabras, el bot se detiene y la conversación queda disponible para un asesor.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensaje al transferir
                    </label>
                    <Textarea
                      value={settings.escape_message || ''}
                      onChange={(e) => handleChange('escape_message', e.target.value)}
                      placeholder="🙋 Entendido, te vamos a comunicar con un asesor que podrá ayudarte. Por favor espera un momento."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </Tabs.Item>

        {/* Tab: IA */}
        <Tabs.Item title="Inteligencia Artificial" icon={() => <Icon icon="solar:magic-stick-3-bold" className="w-4 h-4 mr-2" />}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
              <ToggleSwitch
                checked={settings.ai_enabled || false}
                onChange={(checked) => handleChange('ai_enabled', checked)}
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Habilitar IA</p>
                <p className="text-sm text-gray-500">Usar inteligencia artificial para respuestas</p>
              </div>
            </div>

            {settings.ai_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proveedor de IA
                  </label>
                  <Select
                    value={settings.ai_provider || 'none'}
                    onChange={(e) => handleChange('ai_provider', e.target.value)}
                  >
                    <option value="none">Ninguno</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="claude">Anthropic (Claude)</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Modelo
                  </label>
                  <Select
                    value={settings.ai_model || ''}
                    onChange={(e) => handleChange('ai_model', e.target.value)}
                  >
                    {settings.ai_provider === 'openai' && (
                      <>
                        <option value="gpt-4o-mini">GPT-4o Mini (Económico)</option>
                        <option value="gpt-4o">GPT-4o (Avanzado)</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      </>
                    )}
                    {settings.ai_provider === 'claude' && (
                      <>
                        <option value="claude-3-haiku">Claude 3 Haiku (Rápido)</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet (Balanceado)</option>
                        <option value="claude-3-opus">Claude 3 Opus (Avanzado)</option>
                      </>
                    )}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt del sistema
                  </label>
                  <Textarea
                    value={settings.ai_system_prompt || ''}
                    onChange={(e) => handleChange('ai_system_prompt', e.target.value)}
                    placeholder="Eres un asistente virtual amable y profesional..."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Instrucciones para la IA sobre cómo comportarse
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Temperatura ({settings.ai_temperature || 0.7})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.ai_temperature || 0.7}
                      onChange={(e) => handleChange('ai_temperature', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Mayor = más creativo, Menor = más preciso
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Máximo de tokens
                    </label>
                    <TextInput
                      type="number"
                      value={settings.ai_max_tokens || 500}
                      onChange={(e) => handleChange('ai_max_tokens', parseInt(e.target.value))}
                      min={50}
                      max={4000}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Tabs.Item>
      </Tabs>

      {/* Botón guardar */}
      {hasChanges && (
        <div className="flex justify-end sticky bottom-0 bg-white dark:bg-gray-900 py-4 border-t">
          <Button color="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Icon icon="svg-spinners:ring-resize" className="w-4 h-4 mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Icon icon="solar:diskette-bold" className="w-4 h-4 mr-2" />
                Guardar cambios
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChatbotSettings;

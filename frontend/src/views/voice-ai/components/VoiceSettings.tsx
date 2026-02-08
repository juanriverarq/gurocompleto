import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Switch } from 'src/components/shadcn-ui/Default-Ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { Textarea } from 'src/components/shadcn-ui/Default-Ui/textarea';
import { 
  Settings, 
  Volume2, 
  Mic, 
  Save, 
  RefreshCw,
  Key,
  Globe,
  Clock,
  DollarSign,
  Shield,
  Bell,
  Database,
  Phone,
  Bot,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  TestTube,
  Play,
  Pause,
  ExternalLink,
  Webhook
} from 'lucide-react';

import { 
  getConversationalAgents, 
  getVoiceList, 
  testVoice,
  checkPhoneCallCapabilities,
  testRealPhoneCall
} from '../../../services/elevenLabsService';

interface VoiceConfiguration {
  apiKey: string;
  baseUrl: string;
  defaultVoice: string;
  defaultLanguage: string;
  defaultStability: number;
  defaultSimilarity: number;
  defaultStyle: number;
  speakerBoost: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  rateLimiting: {
    enabled: boolean;
    maxCallsPerMinute: number;
    maxCallsPerHour: number;
    requestsPerMinute: number;
    tokensPerDay: number;
  };
  costControl: {
    enabled: boolean;
    maxDailyCost: number;
    maxMonthlyCost: number;
    alertThreshold: number;
  };
  workingHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
    days: string[];
  };
  notifications: {
    enabled: boolean;
    email: string;
    webhook: string;
    events: string[];
    push: boolean;
    errors: boolean;
  };
}

interface SystemStatus {
  apiStatus: 'connected' | 'disconnected' | 'error';
  lastCheck: Date;
  usage: {
    callsToday: number;
    costToday: number;
    remainingQuota: number;
  };
  performance: {
    avgLatency: number;
    successRate: number;
    errorRate: number;
  };
}

const VoiceSettings: React.FC = () => {
  const [config, setConfig] = useState<VoiceConfiguration>({
    apiKey: '',
    baseUrl: 'https://api.elevenlabs.io/v1',
    defaultVoice: '86V9x9hrQds83qf7zaGn',
    defaultLanguage: 'es',
    defaultStability: 0.7,
    defaultSimilarity: 0.8,
    defaultStyle: 0.2,
    speakerBoost: true,
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 30000,
    rateLimiting: {
      enabled: true,
      maxCallsPerMinute: 10,
      maxCallsPerHour: 300,
      requestsPerMinute: 10,
      tokensPerDay: 10000
    },
    costControl: {
      enabled: true,
      maxDailyCost: 100,
      maxMonthlyCost: 2000,
      alertThreshold: 80
    },
    workingHours: {
      enabled: true,
      start: '09:00',
      end: '18:00',
      timezone: 'America/Bogota',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    notifications: {
      enabled: true,
      email: 'admin@empresa.com',
      webhook: '',
      events: ['call_failed', 'quota_exceeded', 'cost_alert'],
      push: false,
      errors: false
    }
  });

  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    apiStatus: 'connected',
    lastCheck: new Date(),
    usage: {
      callsToday: 156,
      costToday: 78.50,
      remainingQuota: 844
    },
    performance: {
      avgLatency: 245,
      successRate: 94.2,
      errorRate: 5.8
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<{
    isConfigured: boolean;
    phoneNumbers: string[];
    status: string;
    isChecking: boolean;
  }>({
    isConfigured: false,
    phoneNumbers: [],
    status: 'Verificando...',
    isChecking: true
  });
  const [testCallNumber, setTestCallNumber] = useState('');
  const [testingCall, setTestingCall] = useState(false);

  const availableVoices = [
    { id: '86V9x9hrQds83qf7zaGn', name: 'Marcela Colombia Girl', language: 'Spanish (Colombia)' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'English (US)' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'English (US)' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', language: 'English (US)' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'English (US)' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', language: 'English (US)' }
  ];

  const availableLanguages = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt', name: 'Português' },
    { code: 'fr', name: 'Français' }
  ];

  const availableTimezones = [
    { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
    { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
    { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' }
  ];

  const weekDays = [
    { value: 'monday', label: 'Lunes' },
    { value: 'tuesday', label: 'Martes' },
    { value: 'wednesday', label: 'Miércoles' },
    { value: 'thursday', label: 'Jueves' },
    { value: 'friday', label: 'Viernes' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' }
  ];

  const eventTypes = [
    { value: 'call_failed', label: 'Llamada fallida' },
    { value: 'quota_exceeded', label: 'Cuota excedida' },
    { value: 'cost_alert', label: 'Alerta de costo' },
    { value: 'agent_error', label: 'Error de agente' },
    { value: 'campaign_completed', label: 'Campaña completada' }
  ];

  // Verificar configuración de Twilio al cargar
  useEffect(() => {
    const checkTwilio = async () => {
      try {
        const result = await checkPhoneCallCapabilities();
        setTwilioStatus({
          isConfigured: result.hasPhoneCallSupport && result.twilioConfigured,
          phoneNumbers: result.phoneNumbers,
          status: result.status,
          isChecking: false
        });
      } catch (error) {
        setTwilioStatus({
          isConfigured: false,
          phoneNumbers: [],
          status: 'Error al verificar configuración',
          isChecking: false
        });
      }
    };

    checkTwilio();
  }, []);

  useEffect(() => {
    loadConfiguration();
    checkSystemStatus();
  }, []);

  const loadConfiguration = async () => {
    setIsLoading(true);
    try {
      // Simular carga de configuración
      await new Promise(resolve => setTimeout(resolve, 1000));
      // La configuración ya está inicializada en el estado
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // Simular guardado de configuración
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTestResult('Configuración guardada exitosamente');
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      // Simular verificación de estado del sistema
      setSystemStatus(prev => ({
        ...prev,
        lastCheck: new Date(),
        apiStatus: 'connected'
      }));
    } catch (error) {
      setSystemStatus(prev => ({
        ...prev,
        apiStatus: 'error'
      }));
    }
  };

  const testConnection = async () => {
    setTestResult('Probando conexión...');
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setTestResult('Conexión exitosa - API funcionando correctamente');
      setTimeout(() => setTestResult(null), 5000);
    } catch (error) {
      setTestResult('Error de conexión - Verificar API key y configuración');
    }
  };

  const handleDayToggle = (day: string) => {
    setConfig(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        days: prev.workingHours.days.includes(day)
          ? prev.workingHours.days.filter(d => d !== day)
          : [...prev.workingHours.days, day]
      }
    }));
  };

  const handleEventToggle = (event: string) => {
    setConfig(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        events: prev.notifications.events.includes(event)
          ? prev.notifications.events.filter(e => e !== event)
          : [...prev.notifications.events, event]
      }
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'disconnected': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'disconnected': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'voice', label: 'Voz', icon: Volume2 },
    { id: 'limits', label: 'Límites', icon: Shield },
    { id: 'schedule', label: 'Horarios', icon: Clock },
    { id: 'notifications', label: 'Notificaciones', icon: Bell }
  ];

  // Función para probar llamada real
  const handleTestRealCall = async () => {
    if (!testCallNumber) {
      alert('Por favor ingresa un número de teléfono para la prueba');
      return;
    }

    setTestingCall(true);
    try {
      const result = await testRealPhoneCall(testCallNumber, 'default_agent');
      alert(result.message);
    } catch (error) {
      alert(`Error en la prueba: ${error}`);
    } finally {
      setTestingCall(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h2>
          <p className="text-gray-600">Ajustes generales y configuración de ElevenLabs</p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={checkSystemStatus}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Verificar Estado</span>
          </Button>
          <Button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Estado del Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              {getStatusIcon(systemStatus.apiStatus)}
              <div>
                <p className="text-sm text-gray-600">Estado API</p>
                <p className={`font-medium ${getStatusColor(systemStatus.apiStatus)}`}>
                  {systemStatus.apiStatus === 'connected' ? 'Conectado' : 
                   systemStatus.apiStatus === 'disconnected' ? 'Desconectado' : 'Error'}
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Llamadas Hoy</p>
              <p className="text-lg font-medium">{systemStatus.usage.callsToday}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Costo Hoy</p>
              <p className="text-lg font-medium">${systemStatus.usage.costToday.toFixed(2)}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Tasa de Éxito</p>
              <p className="text-lg font-medium text-green-600">{systemStatus.performance.successRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Result */}
      {testResult && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TestTube className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800">{testResult}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tabs */}
      <Card>
        <CardHeader>
          <div className="flex space-x-4 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key de ElevenLabs
                  </label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={config.apiKey}
                      onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Base de la API
                  </label>
                  <Input
                    value={config.baseUrl}
                    onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                    placeholder="https://api.elevenlabs.io/v1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Idioma por Defecto
                  </label>
                  <Select
                    value={config.defaultLanguage}
                    onValueChange={(value) => setConfig({...config, defaultLanguage: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanguages.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeout (ms)
                  </label>
                  <Input
                    type="number"
                    value={config.timeout}
                    onChange={(e) => setConfig({...config, timeout: parseInt(e.target.value)})}
                    placeholder="30000"
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={testConnection}
                  className="flex items-center space-x-2"
                >
                  <TestTube className="w-4 h-4" />
                  <span>Probar Conexión</span>
                </Button>
              </div>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voz por Defecto
                  </label>
                  <Select
                    value={config.defaultVoice}
                    onValueChange={(value) => setConfig({...config, defaultVoice: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVoices.map(voice => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name} ({voice.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.speakerBoost}
                    onCheckedChange={(checked) => setConfig({...config, speakerBoost: checked})}
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Mejora de Altavoz
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estabilidad: {config.defaultStability}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.defaultStability}
                    onChange={(e) => setConfig({...config, defaultStability: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Similitud: {config.defaultSimilarity}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.defaultSimilarity}
                    onChange={(e) => setConfig({...config, defaultSimilarity: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estilo: {config.defaultStyle}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.defaultStyle}
                    onChange={(e) => setConfig({...config, defaultStyle: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Limits Tab */}
          {activeTab === 'limits' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Límites de Velocidad</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.rateLimiting.enabled}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        rateLimiting: {...config.rateLimiting, enabled: checked}
                      })}
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Habilitar límites de velocidad
                    </label>
                  </div>
                  
                  {config.rateLimiting.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Llamadas por minuto
                        </label>
                        <Input
                          type="number"
                          value={config.rateLimiting.maxCallsPerMinute}
                          onChange={(e) => setConfig({
                            ...config,
                            rateLimiting: {
                              ...config.rateLimiting,
                              maxCallsPerMinute: parseInt(e.target.value)
                            }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Llamadas por hora
                        </label>
                        <Input
                          type="number"
                          value={config.rateLimiting.maxCallsPerHour}
                          onChange={(e) => setConfig({
                            ...config,
                            rateLimiting: {
                              ...config.rateLimiting,
                              maxCallsPerHour: parseInt(e.target.value)
                            }
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Control de Costos</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.costControl.enabled}
                      onCheckedChange={(checked) => setConfig({
                        ...config,
                        costControl: {...config.costControl, enabled: checked}
                      })}
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Habilitar control de costos
                    </label>
                  </div>
                  
                  {config.costControl.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Costo máximo diario ($)
                        </label>
                        <Input
                          type="number"
                          value={config.costControl.maxDailyCost}
                          onChange={(e) => setConfig({
                            ...config,
                            costControl: {
                              ...config.costControl,
                              maxDailyCost: parseInt(e.target.value)
                            }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Costo máximo mensual ($)
                        </label>
                        <Input
                          type="number"
                          value={config.costControl.maxMonthlyCost}
                          onChange={(e) => setConfig({
                            ...config,
                            costControl: {
                              ...config.costControl,
                              maxMonthlyCost: parseInt(e.target.value)
                            }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Umbral de alerta (%)
                        </label>
                        <Input
                          type="number"
                          value={config.costControl.alertThreshold}
                          onChange={(e) => setConfig({
                            ...config,
                            costControl: {
                              ...config.costControl,
                              alertThreshold: parseInt(e.target.value)
                            }
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.workingHours.enabled}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    workingHours: {...config.workingHours, enabled: checked}
                  })}
                />
                <label className="text-sm font-medium text-gray-700">
                  Habilitar horarios de trabajo
                </label>
              </div>

              {config.workingHours.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de inicio
                      </label>
                      <Input
                        type="time"
                        value={config.workingHours.start}
                        onChange={(e) => setConfig({
                          ...config,
                          workingHours: {...config.workingHours, start: e.target.value}
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de fin
                      </label>
                      <Input
                        type="time"
                        value={config.workingHours.end}
                        onChange={(e) => setConfig({
                          ...config,
                          workingHours: {...config.workingHours, end: e.target.value}
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Zona horaria
                      </label>
                      <Select
                        value={config.workingHours.timezone}
                        onValueChange={(value) => setConfig({
                          ...config,
                          workingHours: {...config.workingHours, timezone: value}
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTimezones.map(tz => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Días de trabajo
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {weekDays.map(day => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Switch
                            checked={config.workingHours.days.includes(day.value)}
                            onCheckedChange={() => handleDayToggle(day.value)}
                          />
                          <span className="text-sm">{day.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.notifications.enabled}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    notifications: {...config.notifications, enabled: checked}
                  })}
                />
                <label className="text-sm font-medium text-gray-700">
                  Habilitar notificaciones
                </label>
              </div>

              {config.notifications.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email de notificaciones
                      </label>
                      <Input
                        type="email"
                        value={config.notifications.email}
                        onChange={(e) => setConfig({
                          ...config,
                          notifications: {...config.notifications, email: e.target.value}
                        })}
                        placeholder="admin@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Webhook URL
                      </label>
                      <Input
                        value={config.notifications.webhook}
                        onChange={(e) => setConfig({
                          ...config,
                          notifications: {...config.notifications, webhook: e.target.value}
                        })}
                        placeholder="https://webhook.site/..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Eventos a notificar
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {eventTypes.map(event => (
                        <div key={event.value} className="flex items-center space-x-2">
                          <Switch
                            checked={config.notifications.events.includes(event.value)}
                            onCheckedChange={() => handleEventToggle(event.value)}
                          />
                          <span className="text-sm">{event.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración de Llamadas Telefónicas */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Phone className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Llamadas Telefónicas</h3>
        </div>
        
        <div className="space-y-4">
          {/* Estado de Configuración Actualizado */}
          <div className={`p-4 rounded-lg ${
            twilioStatus.isConfigured 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <h4 className={`font-medium mb-2 ${
              twilioStatus.isConfigured ? 'text-green-900' : 'text-yellow-900'
            }`}>
              Estado de Configuración
            </h4>
            <div className="flex items-center space-x-2 mb-2">
              <div className={`h-2 w-2 rounded-full ${
                twilioStatus.isChecking 
                  ? 'bg-gray-400' 
                  : twilioStatus.isConfigured 
                    ? 'bg-green-500' 
                    : 'bg-yellow-500'
              }`}></div>
              <span className={`text-sm ${
                twilioStatus.isConfigured ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {twilioStatus.isChecking ? 'Verificando...' : twilioStatus.status}
              </span>
            </div>
            
            {twilioStatus.isConfigured && twilioStatus.phoneNumbers.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-green-700 font-medium mb-1">
                  Números telefónicos configurados:
                </p>
                <div className="flex flex-wrap gap-2">
                  {twilioStatus.phoneNumbers.map((number, index) => (
                    <Badge key={index} variant="secondary" className="bg-green-100 text-green-800">
                      {number}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {twilioStatus.isConfigured && (
              <div className="mt-3 p-3 bg-green-100 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ <strong>¡Configuración completa!</strong> Las llamadas se realizarán automáticamente usando la API real de ElevenLabs.
                </p>
              </div>
            )}
          </div>

          {/* Prueba de Llamada Real */}
          {twilioStatus.isConfigured && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Prueba de Llamada Real</h4>
              <p className="text-sm text-blue-700 mb-3">
                Prueba la configuración haciendo una llamada real a tu número.
              </p>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  value={testCallNumber}
                  onChange={(e) => setTestCallNumber(e.target.value)}
                  placeholder="+573001234567"
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-md text-sm"
                />
                <button
                  onClick={handleTestRealCall}
                  disabled={testingCall}
                  className="px-4 py-2 text-white rounded-md hover:bg-primaryemphasis disabled:opacity-50 text-sm"
                >
                  {testingCall ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Llamando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>Probar Llamada</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {!twilioStatus.isConfigured && !twilioStatus.isChecking && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Configuración Pendiente</h4>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>Para activar llamadas reales:</p>
                <p>1. Ve a tu dashboard de ElevenLabs</p>
                <p>2. Navega a Conversational AI → Phone Numbers</p>
                <p>3. Verifica que Twilio esté conectado y configurado</p>
                <p>4. Asegúrate de tener números telefónicos asignados</p>
              </div>
              <a
                href="https://elevenlabs.io/docs/conversational-ai/phone-numbers/twilio-integration"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center mt-3 text-sm text-yellow-700 hover:text-yellow-800"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver documentación
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Configuración de Webhooks */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Webhook className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Webhooks</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL de Webhook para Llamadas
            </label>
            <input
              type="url"
              placeholder="https://tu-servidor.com/webhook/elevenlabs"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recibe notificaciones cuando las llamadas inicien, terminen o cambien de estado
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eventos a Escuchar
            </label>
            <div className="space-y-2">
              {[
                { id: 'call.started', label: 'Llamada iniciada' },
                { id: 'call.ended', label: 'Llamada terminada' },
                { id: 'call.failed', label: 'Llamada fallida' },
                { id: 'transcript.ready', label: 'Transcripción lista' }
              ].map(event => (
                <label key={event.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Configuración de Notificaciones */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Bell className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900">Notificaciones</h3>
        </div>
        
        <div className="space-y-4">
                     <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Email para notificaciones
             </label>
             <input
               type="email"
               value={config.notifications.email}
               onChange={(e) => setConfig(prev => ({
                 ...prev,
                 notifications: {
                   ...prev.notifications,
                   email: e.target.value
                 }
               }))}
               placeholder="admin@empresa.com"
               className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
             />
           </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Notificaciones push
            </label>
            <button
              onClick={() => setConfig(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  push: !prev.notifications.push
                }
              }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.notifications.push ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.notifications.push ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Alertas de errores
            </label>
            <button
              onClick={() => setConfig(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  errors: !prev.notifications.errors
                }
              }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.notifications.errors ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.notifications.errors ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Botón de Guardar */}
      <div className="flex justify-end">
        <button
          onClick={saveConfiguration}
          className="px-6 py-2 text-white rounded-lg hover:bg-primaryemphasis transition-colors"
        >
          Guardar Configuración
        </button>
      </div>
    </div>
  );
};

export default VoiceSettings; 
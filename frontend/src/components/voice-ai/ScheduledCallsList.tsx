import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn-ui/Default-Ui/card';
import { Button } from '../shadcn-ui/Default-Ui/button';
import { Badge } from '../shadcn-ui/Default-Ui/badge';
import { Icon } from '@iconify/react';
import voiceCampaignService, { ScheduledCall } from '../../services/voiceCampaignService';

interface ScheduledCallsListProps {
  campaignId: number;
  onCallExecuted?: () => void;
  onStatsLoaded?: (stats: { total: number; pending: number; completed: number; failed: number }) => void;
}

const ScheduledCallsList: React.FC<ScheduledCallsListProps> = ({ campaignId, onCallExecuted, onStatsLoaded }) => {
  const [calls, setCalls] = useState<ScheduledCall[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [executingCallId, setExecutingCallId] = useState<number | null>(null);

  const loadScheduledCalls = async () => {
    setIsLoading(true);
    try {
      const response = await voiceCampaignService.getScheduledCalls(campaignId);
      if (response.success && response.data) {
        setCalls(response.data.calls || []);
        const newStats = {
          total: response.data.total || 0,
          pending: response.data.pending || 0,
          completed: response.data.completed || 0,
          failed: response.data.failed || 0,
        };
        setStats(newStats);
        // Notificar al padre las estadísticas
        onStatsLoaded?.(newStats);
      }
    } catch (error) {
      console.error('Error loading scheduled calls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      loadScheduledCalls();
    }
  }, [campaignId]);

  const executeCall = async (callId: number) => {
    setExecutingCallId(callId);
    try {
      const response = await voiceCampaignService.executeScheduledCall(callId);
      if (response.success) {
        await loadScheduledCalls();
        onCallExecuted?.();
      } else {
        alert(response.message || 'Error al ejecutar la llamada');
      }
    } catch (error) {
      console.error('Error executing call:', error);
      alert('Error al ejecutar la llamada');
    } finally {
      setExecutingCallId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', label: 'Pendiente' },
      queued: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', label: 'En cola' },
      called: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300', label: 'Llamando' },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', label: 'Completada' },
      skipped: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300', label: 'Omitida' },
      failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', label: 'Fallida' },
      cancelled: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400', label: 'Cancelada' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={`text-xs whitespace-nowrap ${config.color}`}>{config.label}</Badge>;
  };

  const getReasonInSpanish = (reason: string): string => {
    if (!reason) return 'Sin especificar';
    
    // Mapeo directo para razones conocidas
    const reasonMap: Record<string, string> = {
      'payment_due_7_days': 'Pago vence en 7 días',
      'payment_due_4_days': 'Pago vence en 4 días',
      'payment_due_3_days': 'Pago vence en 3 días',
      'payment_due_2_days': 'Pago vence en 2 días',
      'payment_due_1_day': 'Pago vence mañana',
      'payment_due_1_days': 'Pago vence mañana',
      'payment_due_today': 'Pago vence hoy',
      'payment_due_0_days': 'Pago vence hoy',
      'payment_overdue_1_day': 'Pago vencido (1 día)',
      'payment_overdue_1_days': 'Pago vencido (1 día)',
      'payment_overdue_2_days': 'Pago vencido (2 días)',
      'payment_overdue_3_days': 'Pago vencido (3 días)',
      'payment_overdue_4_days': 'Pago vencido (4 días)',
      'payment_overdue_5_days': 'Pago vencido (5 días)',
      'payment_overdue_7_days': 'Pago vencido (7 días)',
      'policy_expiry': 'Vencimiento de póliza',
      'new_client': 'Cliente nuevo',
      'new_policy': 'Póliza nueva',
      'manual': 'Manual',
    };
    
    if (reasonMap[reason]) return reasonMap[reason];
    
    // Traducción dinámica para patrones no mapeados
    const dueMatch = reason.match(/payment_due_(\d+)_days?/);
    if (dueMatch) return `Pago vence en ${dueMatch[1]} días`;
    
    const overdueMatch = reason.match(/payment_overdue_(\d+)_days?/);
    if (overdueMatch) return `Pago vencido (${overdueMatch[1]} días)`;
    
    return reason.replace(/_/g, ' ');
  };

  // Traducir status_reason de VAPI al español
  const translateStatusReason = (reason: string): string => {
    if (!reason) return '';
    const translations: Record<string, string> = {
      'customer-did-not-answer': 'No contestó',
      'customer-busy': 'Ocupado',
      'no-answer': 'Sin respuesta',
      'busy': 'Ocupado',
      'voicemail': 'Buzón de voz',
      'machine-detected': 'Contestadora detectada',
      'failed': 'Error en la llamada',
      'dial-no-answer': 'Sin respuesta al marcar',
      'dial-busy': 'Línea ocupada',
      'silence-timed-out': 'Tiempo de silencio agotado',
      'customer-ended-call': 'Cliente colgó',
      'assistant-said-end-call-phrase': 'Llamada finalizada',
      'max-duration-reached': 'Duración máxima alcanzada',
      'Llamada completada exitosamente': 'Llamada completada exitosamente',
      'Llamada no exitosa': 'Llamada no exitosa',
    };
    return translations[reason] || reason.replace(/-/g, ' ').replace(/_/g, ' ');
  };

  // Determinar si una llamada puede reintentarse
  const canRetry = (call: ScheduledCall): boolean => {
    const retryableReasons = ['customer-did-not-answer', 'no-answer', 'busy', 'customer-busy', 'dial-no-answer', 'dial-busy', 'silence-timed-out'];
    return call.status === 'failed' && retryableReasons.includes(call.status_reason || '');
  };

  // Reintentar llamada
  const retryCall = async (callId: number) => {
    try {
      // Resetear el estado a pendiente usando el servicio
      const result = await voiceCampaignService.retryScheduledCall(callId);
      if (result.success) {
        loadScheduledCalls();
        onCallExecuted?.();
      } else {
        console.error('Error retrying call:', result.message);
      }
    } catch (error) {
      console.error('Error retrying call:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Icon icon="svg-spinners:ring-resize" className="w-8 h-8 mx-auto text-blue-600" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Cargando llamadas programadas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="solar:calendar-bold" className="w-5 h-5 text-blue-600" />
            Llamadas Programadas
          </div>
          <Button size="sm" variant="outline" onClick={loadScheduledCalls}>
            <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {/* Resumen de estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pendientes</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completadas</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Fallidas</div>
          </div>
        </div>

        {/* Lista de llamadas */}
        {calls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Icon icon="solar:phone-calling-rounded-line-duotone" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay llamadas programadas para esta campaña</p>
            <p className="text-sm mt-1">Las llamadas se programan automáticamente según el objetivo de la campaña</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div 
                key={call.id} 
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 gap-2"
              >
                {/* Info del cliente y razón */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {call.client_name}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{call.client_phone}</span>
                  </div>
                  {/* Información de la póliza */}
                  {(call.contact_data?.policy_number || call.contact_data?.policy_type) && (
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-purple-600 dark:text-purple-400">
                      <Icon icon="solar:document-bold" className="w-3 h-3" />
                      <span className="truncate">
                        {call.contact_data?.policy_type && call.contact_data.policy_type !== 'otros' 
                          ? call.contact_data.policy_type 
                          : 'Póliza'
                        }
                        {call.contact_data?.policy_number && ` - ${call.contact_data.policy_number}`}
                      </span>
                      {/* Fecha de vencimiento de la póliza */}
                      {(call.contact_data?.end_date || call.contact_data?.expiry_date) && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-orange-600 dark:text-orange-400">
                            Vencimiento de póliza: {call.contact_data?.end_date || call.contact_data?.expiry_date}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>{getReasonInSpanish(call.reason)}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      Llamada: {formatDate(call.scheduled_date)}{call.scheduled_time ? ` a las ${call.scheduled_time}` : ''}
                    </span>
                  </div>
                  {call.status === 'failed' && call.status_reason && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400 truncate" title={call.status_reason}>
                      {translateStatusReason(call.status_reason)}
                    </div>
                  )}
                </div>

                {/* Estado y acciones */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(call.status)}
                  
                  {call.status === 'pending' && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-7"
                      onClick={() => executeCall(call.id)}
                      disabled={executingCallId === call.id}
                    >
                      {executingCallId === call.id ? (
                        <Icon icon="svg-spinners:ring-resize" className="w-3.5 h-3.5" />
                      ) : (
                        <Icon icon="solar:phone-calling-bold" className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                  
                  {call.status === 'called' && (
                    <Icon icon="svg-spinners:pulse-3" className="w-4 h-4 text-purple-600" />
                  )}
                  
                  {call.status === 'completed' && (
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600" />
                  )}
                  
                  {canRetry(call) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-2 py-1 h-7 border-orange-500 text-orange-600 hover:bg-orange-50"
                      onClick={() => retryCall(call.id)}
                      title="Reintentar llamada"
                    >
                      <Icon icon="solar:refresh-bold" className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  
                  {call.status === 'failed' && !canRetry(call) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-2 py-1 h-7 border-gray-300 text-gray-400 cursor-not-allowed opacity-50"
                      disabled
                      title="No se puede reintentar: el error impide ejecutar la llamada. Probablemente sea un número de teléfono no válido."
                    >
                      <Icon icon="solar:refresh-bold" className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduledCallsList;

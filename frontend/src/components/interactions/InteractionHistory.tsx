import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Alert, AlertDescription } from 'src/components/shadcn-ui/Default-Ui/alert';
import { useToast } from 'src/hooks/use-toast';

// Tipos para el historial
export interface MessageInteraction {
  id: number;
  campaign_id: number;
  campaign_name: string;
  client_id: number;
  client_name: string;
  client_phone: string;
  message_content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  failed_reason?: string;
  whatsapp_message_id?: string;
  retry_count: number;
}

interface InteractionHistoryProps {
  className?: string;
}

// Servicio para el historial de interacciones
class InteractionHistoryService {
  async getInteractions(filters?: {
    campaign_id?: number;
    client_id?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  }): Promise<MessageInteraction[]> {
    // TODO: Implementar llamada real a la API
    // Por ahora retornar array vacío hasta que se implemente el backend
    return [];
  }

  async exportToCSV(interactions: MessageInteraction[]): Promise<string> {
    const headers = [
      'ID',
      'Campaña',
      'Cliente',
      'Teléfono',
      'Estado',
      'Enviado',
      'Entregado',
      'Leído',
      'Mensaje'
    ];

    const rows = interactions.map(interaction => [
      interaction.id,
      interaction.campaign_name,
      interaction.client_name,
      interaction.client_phone,
      interaction.status,
      new Date(interaction.sent_at).toLocaleString(),
      interaction.delivered_at ? new Date(interaction.delivered_at).toLocaleString() : '',
      interaction.read_at ? new Date(interaction.read_at).toLocaleString() : '',
      interaction.message_content.substring(0, 100) + (interaction.message_content.length > 100 ? '...' : '')
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

const interactionHistoryService = new InteractionHistoryService();

const InteractionHistory: React.FC<InteractionHistoryProps> = ({ className }) => {
  const { toast } = useToast();
  
  const [interactions, setInteractions] = useState<MessageInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filtros
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    date_from: '',
    date_to: '',
    campaign_id: ''
  });

  useEffect(() => {
    loadInteractions();
  }, [filters]);

  const loadInteractions = async () => {
    setLoading(true);
    try {
      const result = await interactionHistoryService.getInteractions({
        search: filters.search || undefined,
        status: filters.status || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        campaign_id: filters.campaign_id ? parseInt(filters.campaign_id) : undefined
      });
      setInteractions(result);
    } catch (error) {
      console.error('Error loading interactions:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de interacciones",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csvContent = await interactionHistoryService.exportToCSV(interactions);
      
      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `historial_interacciones_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Éxito",
        description: "Historial exportado correctamente"
      });
    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el historial",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return 'solar:paper-plane-bold';
      case 'delivered': return 'solar:check-circle-bold';
      case 'read': return 'solar:eye-bold';
      case 'failed': return 'solar:close-circle-bold';
      case 'pending': return 'solar:clock-circle-bold';
      default: return 'solar:question-circle-bold';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'read': return 'bg-purple-100 text-purple-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'read': return 'Leído';
      case 'failed': return 'Fallido';
      case 'pending': return 'Pendiente';
      default: return 'Desconocido';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Interacciones</h1>
          <p className="text-gray-600">Registro completo de mensajes enviados y estados de entrega</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadInteractions}
            disabled={loading}
          >
            <Icon 
              icon={loading ? "solar:refresh-bold animate-spin" : "solar:refresh-bold"} 
              className="w-4 h-4 mr-2" 
            />
            Actualizar
          </Button>
          
          <Button
            onClick={handleExport}
            disabled={exporting || interactions.length === 0}
          >
            <Icon 
              icon={exporting ? "solar:refresh-bold animate-spin" : "solar:download-bold"} 
              className="w-4 h-4 mr-2" 
            />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Cliente, teléfono, campaña..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full p-2 border rounded"
              >
                <option value="">Todos los estados</option>
                <option value="sent">Enviado</option>
                <option value="delivered">Entregado</option>
                <option value="read">Leído</option>
                <option value="failed">Fallido</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="date-from">Desde</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="date-to">Hasta</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', count: interactions.length, color: 'blue' },
          { label: 'Enviados', count: interactions.filter(i => i.status === 'sent').length, color: 'blue' },
          { label: 'Entregados', count: interactions.filter(i => i.status === 'delivered').length, color: 'green' },
          { label: 'Leídos', count: interactions.filter(i => i.status === 'read').length, color: 'purple' },
          { label: 'Fallidos', count: interactions.filter(i => i.status === 'failed').length, color: 'red' }
        ].map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold text-${stat.color}-600`}>
                {stat.count}
              </div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla de historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Historial de Mensajes</span>
            <Badge variant="outline">
              {interactions.length} registro(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin mr-2" />
              <span>Cargando historial...</span>
            </div>
          ) : interactions.length === 0 ? (
            <div className="text-center py-8">
              <Icon icon="solar:chat-square-code-bold" className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No hay interacciones</h3>
              <p className="text-gray-600">
                {Object.values(filters).some(f => f) 
                  ? 'No se encontraron interacciones con los filtros aplicados'
                  : 'Las interacciones aparecerán aquí cuando se envíen mensajes'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium">Campaña</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium">Enviado</th>
                    <th className="text-left p-3 font-medium">Entregado</th>
                    <th className="text-left p-3 font-medium">Leído</th>
                    <th className="text-left p-3 font-medium">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {interactions.map((interaction) => (
                    <tr key={interaction.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{interaction.client_name}</div>
                          <div className="text-xs text-gray-500">{interaction.client_phone}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{interaction.campaign_name}</div>
                      </td>
                      <td className="p-3">
                        <Badge className={getStatusColor(interaction.status)}>
                          <Icon icon={getStatusIcon(interaction.status)} className="w-3 h-3 mr-1" />
                          {getStatusText(interaction.status)}
                        </Badge>
                        {interaction.retry_count > 0 && (
                          <div className="text-xs text-orange-600 mt-1">
                            {interaction.retry_count} reintento(s)
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {new Date(interaction.sent_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {interaction.delivered_at 
                          ? new Date(interaction.delivered_at).toLocaleString()
                          : '-'
                        }
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {interaction.read_at 
                          ? new Date(interaction.read_at).toLocaleString()
                          : '-'
                        }
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs">
                          <div className="text-xs text-gray-600 truncate">
                            {interaction.message_content}
                          </div>
                          {interaction.failed_reason && (
                            <div className="text-xs text-red-600 mt-1">
                              Error: {interaction.failed_reason}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InteractionHistory;
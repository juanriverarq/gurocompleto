import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../shadcn-ui/Default-Ui/button';
import { Input } from '../shadcn-ui/Default-Ui/input';
import { Label } from '../shadcn-ui/Default-Ui/label';
import { Badge } from '../shadcn-ui/Default-Ui/badge';
import { Card, CardContent } from '../shadcn-ui/Default-Ui/card';
import { Switch } from '../shadcn-ui/Default-Ui/switch';
import { clienteService, Cliente } from '../../services/clienteService';

interface ClientSelectorProps {
  selectedClients: Cliente[];
  onSelectionChange: (clients: Cliente[]) => void;
  selectAll: boolean;
  onSelectAllChange: (selectAll: boolean) => void;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({
  selectedClients,
  onSelectionChange,
  selectAll,
  onSelectAllChange
}) => {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClientList, setShowClientList] = useState(!selectAll);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    console.log('🔄 [ClientSelector] selectAll cambió a:', selectAll);
    console.log('🔄 [ClientSelector] showClientList será:', !selectAll);
    setShowClientList(!selectAll);
    if (selectAll) {
      // Si se selecciona "todos", limpiar la selección específica
      onSelectionChange([]);
    }
  }, [selectAll]);

  // Función para cargar clientes en campañas CON AUTENTICACIÓN Y FILTRADO POR BROKER
  const loadClientsForCampaigns = async () => {
    setLoading(true);
    try {
      console.log('🔄 [ClientSelector] Cargando clientes CON autenticación por broker...');
      
      // Usar clienteService que SÍ tiene autenticación y filtrado por broker
      const response = await clienteService.getAllClientes();
      
      if (response.success && response.data) {
        console.log('🔍 [ClientSelector] Total clientes recibidos del broker:', response.data.length);
        
        // Filtrar solo clientes activos para campañas (incluye 'active', 'activo' y 'prospect')
        const activeClients = response.data.filter(client => 
          (client.estado === 'active' || client.estado === 'activo' || client.estado === 'prospect') && 
          client.celular_principal
        );
        
        console.log('🔍 [ClientSelector] Clientes después del filtro:', activeClients.length);
        console.log('🔍 [ClientSelector] Primeros 3 clientes filtrados:', activeClients.slice(0, 3));
        
        setClients(activeClients);
      } else {
        console.warn('⚠️ [ClientSelector] No se encontraron clientes o hubo error:', response.message);
        setClients([]);
      }
    } catch (error) {
      console.error('❌ [ClientSelector] Error loading clients for campaigns:', error);
      
      // Si falla, establecer array vacío en lugar de mostrar datos incorrectos
      setClients([]);
      
      // Opcional: Mostrar toast de error al usuario
      console.error('No se pudieron cargar los clientes. Verifique su conexión y autenticación.');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = loadClientsForCampaigns;

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.nombre.toLowerCase().includes(searchLower) ||
      client.apellidos.toLowerCase().includes(searchLower) ||
      client.celular_principal.includes(searchTerm) ||
      client.email_principal.toLowerCase().includes(searchLower)
    );
  });

  const handleClientToggle = (client: Cliente) => {
    console.log('🔧 [ClientSelector] Toggle cliente:', client.nombre, client.apellidos);
    const isSelected = selectedClients.some(c => c.id === client.id);
    console.log('🔧 [ClientSelector] Cliente ya seleccionado:', isSelected);
    
    if (isSelected) {
      // Remover cliente
      const newSelection = selectedClients.filter(c => c.id !== client.id);
      console.log('🔧 [ClientSelector] Removiendo cliente. Nueva selección:', newSelection.length);
      onSelectionChange(newSelection);
    } else {
      // Agregar cliente
      const newSelection = [...selectedClients, client];
      console.log('🔧 [ClientSelector] Agregando cliente. Nueva selección:', newSelection.length);
      onSelectionChange(newSelection);
    }
  };

  const handleSelectAllToggle = (checked: boolean) => {
    onSelectAllChange(checked);
  };

  const getSelectedCount = () => {
    if (selectAll) {
      return clients.length;
    }
    return selectedClients.length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Selección de Clientes</Label>
        <Badge variant="outline">
          {getSelectedCount()} cliente{getSelectedCount() !== 1 ? 's' : ''} seleccionado{getSelectedCount() !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Toggle para seleccionar todos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-sm">Todos los clientes activos</p>
                <p className="text-xs text-gray-500">
                  Enviar a todos los clientes con celular ({clients.length} clientes)
                </p>
              </div>
            </div>
            <Switch
              checked={selectAll}
              onCheckedChange={handleSelectAllToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Selector específico de clientes */}
      {showClientList && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Icon icon="solar:user-check-rounded-bold" className="w-4 h-4 text-gray-500" />
            <Label className="text-sm">Selección específica</Label>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Icon 
              icon="solar:magnifer-linear" 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" 
            />
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de clientes seleccionados */}
          {selectedClients.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium text-blue-800 mb-2">Clientes seleccionados:</p>
              <div className="flex flex-wrap gap-1">
                {selectedClients.map(client => (
                  <Badge 
                    key={client.id} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-red-100"
                    onClick={() => handleClientToggle(client)}
                  >
                    {client.nombre} {client.apellidos}
                    <Icon icon="solar:close-circle-bold" className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lista de clientes disponibles */}
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Cargando clientes...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-4 text-center">
                <Icon icon="solar:users-group-rounded-linear" className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes disponibles'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredClients.map(client => {
                  const isSelected = selectedClients.some(c => c.id === client.id);
                  return (
                    <div
                      key={client.id}
                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleClientToggle(client)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm">
                              {client.nombre} {client.apellidos}
                            </p>
                            {isSelected && (
                              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                            <span className="flex items-center">
                              <Icon icon="solar:phone-bold" className="w-3 h-3 mr-1" />
                              {client.celular_principal}
                            </span>
                            {client.email_principal && (
                              <span className="flex items-center">
                                <Icon icon="solar:letter-bold" className="w-3 h-3 mr-1" />
                                {client.email_principal}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="flex justify-between text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange(filteredClients)}
              disabled={loading}
            >
              <Icon icon="solar:check-square-bold" className="w-3 h-3 mr-1" />
              Seleccionar todos los filtrados ({filteredClients.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange([])}
              disabled={selectedClients.length === 0}
            >
              <Icon icon="solar:close-square-bold" className="w-3 h-3 mr-1" />
              Limpiar selección
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;

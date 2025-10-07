import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Textarea } from 'src/components/shadcn-ui/Default-Ui/textarea';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'src/components/shadcn-ui/Default-Ui/dialog';
import { Alert, AlertDescription } from 'src/components/shadcn-ui/Default-Ui/alert';
import { useToast } from 'src/hooks/use-toast';
import { Cliente } from 'src/services/clienteService';
import clientSegmentService, { ClientSegment, SegmentFilter } from 'src/services/clientSegmentService';

interface ClientSegmentManagerProps {
  clients: Cliente[];
  onSegmentSelect?: (segment: ClientSegment, filteredClients: Cliente[]) => void;
  selectedSegmentId?: number;
}

const ClientSegmentManager: React.FC<ClientSegmentManagerProps> = ({
  clients,
  onSegmentSelect,
  selectedSegmentId
}) => {
  const { toast } = useToast();
  
  const [segments, setSegments] = useState<ClientSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<ClientSegment | null>(null);
  
  // Estados para crear/editar segmento
  const [segmentForm, setSegmentForm] = useState<{
    name: string;
    description: string;
    filters: SegmentFilter[];
    color: string;
  }>({
    name: '',
    description: '',
    filters: [],
    color: '#3B82F6'
  });

  const [previewClients, setPreviewClients] = useState<Cliente[]>([]);

  useEffect(() => {
    loadSegments();
  }, []);

  useEffect(() => {
    // Actualizar preview cuando cambien los filtros
    if (segmentForm.filters.length > 0) {
      const filtered = clientSegmentService.applySegmentFilters(clients, segmentForm.filters);
      setPreviewClients(filtered);
    } else {
      setPreviewClients([]);
    }
  }, [segmentForm.filters, clients]);

  const loadSegments = async () => {
    try {
      const result = await clientSegmentService.getSegments();
      setSegments(result);
    } catch (error) {
      console.error('Error loading segments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los segmentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSegment = () => {
    setEditingSegment(null);
    setSegmentForm({
      name: '',
      description: '',
      filters: [],
      color: '#3B82F6'
    });
    setIsCreateModalOpen(true);
  };

  const handleEditSegment = (segment: ClientSegment) => {
    setEditingSegment(segment);
    setSegmentForm({
      name: segment.name,
      description: segment.description || '',
      filters: segment.filters,
      color: segment.color || '#3B82F6'
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveSegment = async () => {
    const validation = clientSegmentService.validateSegment(segmentForm);
    
    if (!validation.isValid) {
      toast({
        title: "Errores de validación",
        description: validation.errors[0],
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingSegment) {
        await clientSegmentService.updateSegment(editingSegment.id!, segmentForm);
        toast({
          title: "Éxito",
          description: "Segmento actualizado correctamente"
        });
      } else {
        await clientSegmentService.createSegment(segmentForm);
        toast({
          title: "Éxito",
          description: "Segmento creado correctamente"
        });
      }
      
      setIsCreateModalOpen(false);
      loadSegments();
    } catch (error) {
      console.error('Error saving segment:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el segmento",
        variant: "destructive"
      });
    }
  };

  const handleDeleteSegment = async (segment: ClientSegment) => {
    if (!confirm(`¿Está seguro de eliminar el segmento "${segment.name}"?`)) {
      return;
    }

    try {
      await clientSegmentService.deleteSegment(segment.id!);
      toast({
        title: "Éxito",
        description: "Segmento eliminado correctamente"
      });
      loadSegments();
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el segmento",
        variant: "destructive"
      });
    }
  };

  const handleSelectSegment = (segment: ClientSegment) => {
    const filteredClients = clientSegmentService.applySegmentFilters(clients, segment.filters);
    onSegmentSelect?.(segment, filteredClients);
  };

  const addFilter = () => {
    const newFilter: SegmentFilter = {
      field: '',
      operator: 'equals',
      value: ''
    };
    setSegmentForm(prev => ({
      ...prev,
      filters: [...prev.filters, newFilter]
    }));
  };

  const updateFilter = (index: number, updates: Partial<SegmentFilter>) => {
    setSegmentForm(prev => ({
      ...prev,
      filters: prev.filters.map((filter, i) => 
        i === index ? { ...filter, ...updates } : filter
      )
    }));
  };

  const removeFilter = (index: number) => {
    setSegmentForm(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  };

  const availableFields = clientSegmentService.getAvailableFields();
  const availableColors = clientSegmentService.getAvailableColors();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin mr-2" />
        <span>Cargando segmentos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Segmentos de Clientes</h2>
          <p className="text-gray-600">Organiza tus clientes en grupos personalizados</p>
        </div>
        <Button onClick={handleCreateSegment}>
          <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
          Nuevo Segmento
        </Button>
      </div>

      {/* Lista de segmentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((segment) => {
          const clientCount = clientSegmentService.countClientsInSegment(clients, segment);
          const isSelected = selectedSegmentId === segment.id;
          
          return (
            <Card 
              key={segment.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleSelectSegment(segment)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <CardTitle className="text-sm">{segment.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSegment(segment);
                      }}
                    >
                      <Icon icon="solar:pen-bold" className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSegment(segment);
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {segment.description && (
                    <p className="text-sm text-gray-600">{segment.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {clientCount} cliente(s)
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {segment.filters.length} filtro(s)
                    </Badge>
                  </div>

                  {/* Preview de filtros */}
                  <div className="text-xs text-gray-500">
                    {segment.filters.slice(0, 2).map((filter, index) => (
                      <div key={index}>
                        {filter.field} {filter.operator} {filter.value}
                      </div>
                    ))}
                    {segment.filters.length > 2 && (
                      <div>... y {segment.filters.length - 2} más</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Card para crear nuevo segmento */}
        <Card 
          className="cursor-pointer transition-all hover:shadow-md border-dashed border-2 border-gray-300 hover:border-blue-400"
          onClick={handleCreateSegment}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Icon icon="solar:add-circle-bold" className="w-12 h-12 text-gray-400 mb-2" />
            <span className="text-gray-600 font-medium">Crear Nuevo Segmento</span>
          </CardContent>
        </Card>
      </div>

      {/* Modal para crear/editar segmento */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? 'Editar Segmento' : 'Crear Nuevo Segmento'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="segment-name">Nombre del Segmento *</Label>
                <Input
                  id="segment-name"
                  placeholder="Ej: Clientes Premium"
                  value={segmentForm.name}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="segment-color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="segment-color"
                    type="color"
                    value={segmentForm.color}
                    onChange={(e) => setSegmentForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-16 h-10"
                  />
                  <div className="flex gap-1">
                    {availableColors.slice(0, 6).map((color) => (
                      <button
                        key={color}
                        onClick={() => setSegmentForm(prev => ({ ...prev, color }))}
                        className={`w-6 h-6 rounded-full border-2 ${
                          segmentForm.color === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="segment-description">Descripción</Label>
              <Textarea
                id="segment-description"
                placeholder="Descripción opcional del segmento"
                value={segmentForm.description}
                onChange={(e) => setSegmentForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Filtros */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <Label className="text-base font-semibold">Filtros de Segmentación</Label>
                <Button onClick={addFilter} size="sm">
                  <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                  Agregar Filtro
                </Button>
              </div>

              {segmentForm.filters.length === 0 ? (
                <Alert>
                  <Icon icon="solar:info-circle-bold" className="w-4 h-4" />
                  <AlertDescription>
                    Agregue al menos un filtro para definir el segmento
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {segmentForm.filters.map((filter, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        {/* Campo */}
                        <div>
                          <Label className="text-xs">Campo</Label>
                          <select
                            value={filter.field}
                            onChange={(e) => updateFilter(index, { field: e.target.value, operator: 'equals', value: '' })}
                            className="w-full p-2 border rounded text-sm"
                          >
                            <option value="">Seleccionar campo</option>
                            {availableFields.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Operador */}
                        <div>
                          <Label className="text-xs">Operador</Label>
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(index, { operator: e.target.value as any })}
                            className="w-full p-2 border rounded text-sm"
                            disabled={!filter.field}
                          >
                            {filter.field && (() => {
                              const field = availableFields.find(f => f.key === filter.field);
                              const operators = clientSegmentService.getOperatorsForFieldType(field?.type || 'text');
                              return operators.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>

                        {/* Valor */}
                        <div>
                          <Label className="text-xs">Valor</Label>
                          {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (
                            <Input
                              placeholder="Valor"
                              value={filter.value}
                              onChange={(e) => updateFilter(index, { value: e.target.value })}
                              className="text-sm"
                            />
                          )}
                        </div>

                        {/* Acciones */}
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeFilter(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Preview de resultados */}
            {segmentForm.filters.length > 0 && (
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Vista Previa ({previewClients.length} cliente(s))
                </Label>
                <Card className="max-h-60 overflow-y-auto">
                  <CardContent className="p-4">
                    {previewClients.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <Icon icon="solar:users-group-rounded-bold" className="w-8 h-8 mx-auto mb-2" />
                        <p>No hay clientes que coincidan con los filtros</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {previewClients.slice(0, 10).map((client) => (
                          <div key={client.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                            <div>
                              <div className="font-medium text-sm">
                                {client.nombre} {client.apellidos}
                              </div>
                              <div className="text-xs text-gray-500">
                                {client.celular_principal} • {client.ciudad}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {client.estado}
                            </Badge>
                          </div>
                        ))}
                        {previewClients.length > 10 && (
                          <div className="text-center text-sm text-gray-500 pt-2">
                            ... y {previewClients.length - 10} más
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Acciones del modal */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSegment}>
                {editingSegment ? 'Actualizar' : 'Crear'} Segmento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientSegmentManager;
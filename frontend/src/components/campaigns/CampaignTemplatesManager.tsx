import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../components/shadcn-ui/Default-Ui/label';
import { Textarea } from '../../components/shadcn-ui/Default-Ui/textarea';
import { Badge } from '../../components/shadcn-ui/Default-Ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Alert, AlertDescription } from '../../components/shadcn-ui/Default-Ui/alert';
import { useToast } from '../../hooks/use-toast';
import {
  campaignTemplateService,
  CampaignTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest
} from '../../services/campaignTemplateService';

interface CampaignTemplatesManagerProps {
  onTemplateSelected?: (template: CampaignTemplate) => void;
}

const CampaignTemplatesManager: React.FC<CampaignTemplatesManagerProps> = ({
  onTemplateSelected
}) => {
  const { toast } = useToast();

  // Estados principales
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);

  // Estados para formularios
  const [formData, setFormData] = useState<CreateTemplateRequest>({
    name: '',
    content: '',
    category: 'general',
    description: '',
    variables: {},
    is_active: true
  });

  const [previewData, setPreviewData] = useState<{
    template: CampaignTemplate;
    preview_content: string;
    sample_data: Record<string, string>;
  } | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  // Recargar cuando cambian los filtros
  useEffect(() => {
    loadTemplates();
  }, [selectedCategory, searchTerm]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await campaignTemplateService.getTemplates({
        category: selectedCategory || undefined,
        search: searchTerm || undefined,
        active: true
      });

      if (response.success && response.data) {
        setTemplates(response.data);
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Error al cargar plantillas',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al cargar plantillas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await campaignTemplateService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      // Validar datos
      if (!formData.name.trim() || !formData.content.trim()) {
        toast({
          title: 'Error',
          description: 'Nombre y contenido son obligatorios',
          variant: 'destructive'
        });
        return;
      }

      // Extraer variables del contenido
      const extractedVars = campaignTemplateService.extractVariables(formData.content);
      const variables: Record<string, string> = {};

      extractedVars.forEach((varName: string) => {
        variables[varName] = formData.variables?.[varName] || '';
      });

      const templateData: CreateTemplateRequest = {
        ...formData,
        variables
      };

      const response = await campaignTemplateService.createTemplate(templateData);

      if (response.success) {
        toast({
          title: 'Éxito',
          description: 'Plantilla creada exitosamente'
        });
        setIsCreateModalOpen(false);
        resetForm();
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Error al crear plantilla',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al crear plantilla',
        variant: 'destructive'
      });
    }
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const templateData: UpdateTemplateRequest = {
        name: formData.name,
        content: formData.content,
        category: formData.category,
        description: formData.description,
        variables: formData.variables,
        is_active: formData.is_active
      };

      const response = await campaignTemplateService.updateTemplate(selectedTemplate.id, templateData);

      if (response.success) {
        toast({
          title: 'Éxito',
          description: 'Plantilla actualizada exitosamente'
        });
        setIsEditModalOpen(false);
        setSelectedTemplate(null);
        resetForm();
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Error al actualizar plantilla',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al actualizar plantilla',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTemplate = async (template: CampaignTemplate) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la plantilla "${template.name}"?`)) {
      return;
    }

    try {
      const response = await campaignTemplateService.deleteTemplate(template.id);

      if (response.success) {
        toast({
          title: 'Éxito',
          description: 'Plantilla eliminada exitosamente'
        });
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Error al eliminar plantilla',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al eliminar plantilla',
        variant: 'destructive'
      });
    }
  };

  const handleDuplicateTemplate = async (template: CampaignTemplate) => {
    try {
      const response = await campaignTemplateService.duplicateTemplate(template.id);

      if (response.success) {
        toast({
          title: 'Éxito',
          description: 'Plantilla duplicada exitosamente'
        });
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Error al duplicar plantilla',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al duplicar plantilla',
        variant: 'destructive'
      });
    }
  };

  const handlePreviewTemplate = async (template: CampaignTemplate) => {
    try {
      const response = await campaignTemplateService.previewTemplate(template.id);

      if (response.success && response.data) {
        setPreviewData(response.data);
        setIsPreviewModalOpen(true);
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Error al generar preview',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al generar preview',
        variant: 'destructive'
      });
    }
  };

  const openEditModal = (template: CampaignTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      description: template.description || '',
      variables: template.variables || {},
      is_active: template.is_active
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      content: '',
      category: 'general',
      description: '',
      variables: {},
      is_active: true
    });
  };

  const updateVariable = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        [key]: value
      }
    }));
  };

  const addVariable = () => {
    const newKey = `variable_${Object.keys(formData.variables || {}).length + 1}`;
    updateVariable(newKey, '');
  };

  const removeVariable = (key: string) => {
    setFormData(prev => {
      const newVariables = { ...prev.variables };
      delete newVariables[key];
      return {
        ...prev,
        variables: newVariables
      };
    });
  };

  // Extraer variables del contenido en tiempo real
  const extractedVars = campaignTemplateService.extractVariables(formData.content);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Plantillas de Mensajes
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona las plantillas de mensajes para tus campañas
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar plantillas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(categories).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Lista de plantillas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Icon icon="solar:refresh-bold" className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Icon icon="solar:document-bold" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No hay plantillas disponibles
            </p>
          </div>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {template.category_name}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePreviewTemplate(template)}
                      title="Vista previa"
                    >
                      <Icon icon="solar:eye-bold" className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(template)}
                      title="Editar"
                    >
                      <Icon icon="solar:pen-bold" className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDuplicateTemplate(template)}
                      title="Duplicar"
                    >
                      <Icon icon="solar:copy-bold" className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteTemplate(template)}
                      title="Eliminar"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                  {template.description || 'Sin descripción'}
                </p>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {template.variables_list.length} variables
                  </div>
                  {onTemplateSelected && (
                    <Button
                      size="sm"
                      onClick={() => onTemplateSelected(template)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Usar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Crear Plantilla */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-darkgray rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Nueva Plantilla
              </h3>
              <Button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
                variant="ghost"
                size="sm"
              >
                <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Nombre</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Recordatorio de póliza"
                  />
                </div>
                <div>
                  <Label htmlFor="template-category">Categoría</Label>
                  <select
                    id="template-category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="template-description">Descripción (opcional)</Label>
                <Textarea
                  id="template-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe el propósito de esta plantilla"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="template-content">Contenido del mensaje</Label>
                <Textarea
                  id="template-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escribe el mensaje. Usa {{variable}} para campos dinámicos."
                  rows={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables detectadas: {extractedVars.join(', ') || 'Ninguna'}
                </p>
              </div>

              {/* Variables */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Variables personalizables</Label>
                  <Button
                    type="button"
                    onClick={addVariable}
                    size="sm"
                    variant="outline"
                  >
                    <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.entries(formData.variables || {}).map(([key, value]) => (
                    <div key={key} className="flex gap-2 items-center">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const newVariables = { ...formData.variables };
                          delete newVariables[key];
                          newVariables[newKey] = value;
                          setFormData(prev => ({ ...prev, variables: newVariables }));
                        }}
                        placeholder="Nombre de variable"
                        className="flex-1"
                      />
                      <Input
                        value={value}
                        onChange={(e) => updateVariable(key, e.target.value)}
                        placeholder="Descripción"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => removeVariable(key)}
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                      >
                        <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Crear Plantilla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Plantilla */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-darkgray rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Editar Plantilla
              </h3>
              <Button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedTemplate(null);
                  resetForm();
                }}
                variant="ghost"
                size="sm"
              >
                <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
              </Button>
            </div>

            {/* Mismo contenido que el modal de crear */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-template-name">Nombre</Label>
                  <Input
                    id="edit-template-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Recordatorio de póliza"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-template-category">Categoría</Label>
                  <select
                    id="edit-template-category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-template-description">Descripción (opcional)</Label>
                <Textarea
                  id="edit-template-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe el propósito de esta plantilla"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="edit-template-content">Contenido del mensaje</Label>
                <Textarea
                  id="edit-template-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escribe el mensaje. Usa {{variable}} para campos dinámicos."
                  rows={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables detectadas: {extractedVars.join(', ') || 'Ninguna'}
                </p>
              </div>

              {/* Variables */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Variables personalizables</Label>
                  <Button
                    type="button"
                    onClick={addVariable}
                    size="sm"
                    variant="outline"
                  >
                    <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.entries(formData.variables || {}).map(([key, value]) => (
                    <div key={key} className="flex gap-2 items-center">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const newVariables = { ...formData.variables };
                          delete newVariables[key];
                          newVariables[newKey] = value;
                          setFormData(prev => ({ ...prev, variables: newVariables }));
                        }}
                        placeholder="Nombre de variable"
                        className="flex-1"
                      />
                      <Input
                        value={value}
                        onChange={(e) => updateVariable(key, e.target.value)}
                        placeholder="Descripción"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => removeVariable(key)}
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                      >
                        <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedTemplate(null);
                  resetForm();
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Actualizar Plantilla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {isPreviewModalOpen && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-darkgray rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Vista Previa: {previewData.template.name}
              </h3>
              <Button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setPreviewData(null);
                }}
                variant="ghost"
                size="sm"
              >
                <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mensaje con datos de ejemplo:
                </Label>
                <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                    {previewData.preview_content}
                  </pre>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Variables utilizadas:
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.entries(previewData.sample_data).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {`{{${key}}}`}
                      </span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setPreviewData(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignTemplatesManager;
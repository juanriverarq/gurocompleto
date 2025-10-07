import React from 'react';
import { Button } from '../shadcn-ui/Default-Ui/button';
import { Input } from '../shadcn-ui/Default-Ui/input';
import { Label } from '../shadcn-ui/Default-Ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shadcn-ui/Default-Ui/select';
import { Textarea } from '../shadcn-ui/Default-Ui/textarea';
import { Icon } from '@iconify/react';
import { Checkbox } from '../shadcn-ui/Default-Ui/checkbox';

interface CustomField {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  required: boolean;
  instruction?: string;
  pattern?: string;
  validation?: {
    min_digits?: number;
    max_digits?: number;
    min_age?: number;
    max_age?: number;
  };
}

interface CollectConfig {
  email?: { enabled: boolean; type: string; required: boolean };
  document_id?: { enabled: boolean; type: string; required: boolean };
  address?: { enabled: boolean; type: string; required: boolean };
}

interface DynamicFieldsConfigProps {
  collectConfig: CollectConfig;
  customFields: CustomField[];
  onCollectConfigChange: (config: CollectConfig) => void;
  onCustomFieldsChange: (fields: CustomField[]) => void;
}

const DynamicFieldsConfig: React.FC<DynamicFieldsConfigProps> = ({
  collectConfig,
  customFields,
  onCollectConfigChange,
  onCustomFieldsChange
}) => {
  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      name: '',
      type: 'custom_text',
      enabled: true,
      required: false,
      instruction: '',
      pattern: ''
    };
    onCustomFieldsChange([...customFields, newField]);
  };

  const updateCustomField = (index: number, updates: Partial<CustomField>) => {
    const updatedFields = [...customFields];
    updatedFields[index] = { ...updatedFields[index], ...updates };
    onCustomFieldsChange(updatedFields);
  };

  const removeCustomField = (index: number) => {
    const updatedFields = customFields.filter((_, i) => i !== index);
    onCustomFieldsChange(updatedFields);
  };

  const updatePredefinedField = (fieldName: keyof CollectConfig, updates: any) => {
    onCollectConfigChange({
      ...collectConfig,
      [fieldName]: { ...collectConfig[fieldName], ...updates }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm font-medium">Configuración de Recolección de Datos</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addCustomField}
        >
          <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" />
          Agregar Campo
        </Button>
      </div>
      
      <div className="space-y-4">
        {/* Campos predefinidos */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3 block">
            Campos Predefinidos
          </Label>
          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!collectConfig.email?.enabled}
                  onCheckedChange={(checked) => updatePredefinedField('email', { enabled: !!checked })}
                />
                <span className="text-sm">Email</span>
                <span className="text-xs text-gray-500">(Patrón automático)</span>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <Checkbox
                  checked={!!collectConfig.email?.required}
                  onCheckedChange={(checked) => updatePredefinedField('email', { required: !!checked })}
                  disabled={!collectConfig.email?.enabled}
                />
                Obligatorio
              </label>
            </div>

            {/* Documento */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!collectConfig.document_id?.enabled}
                  onCheckedChange={(checked) => updatePredefinedField('document_id', { enabled: !!checked })}
                />
                <span className="text-sm">Documento de identidad</span>
                <span className="text-xs text-gray-500">(6-12 dígitos)</span>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <Checkbox
                  checked={!!collectConfig.document_id?.required}
                  onCheckedChange={(checked) => updatePredefinedField('document_id', { required: !!checked })}
                  disabled={!collectConfig.document_id?.enabled}
                />
                Obligatorio
              </label>
            </div>

            {/* Dirección */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!collectConfig.address?.enabled}
                  onCheckedChange={(checked) => updatePredefinedField('address', { enabled: !!checked })}
                />
                <span className="text-sm">Dirección</span>
                <span className="text-xs text-gray-500">(Calle/Carrera/Avenida)</span>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <Checkbox
                  checked={!!collectConfig.address?.required}
                  onCheckedChange={(checked) => updatePredefinedField('address', { required: !!checked })}
                  disabled={!collectConfig.address?.enabled}
                />
                Obligatorio
              </label>
            </div>
          </div>
        </div>

        {/* Campos personalizados */}
        {customFields.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <Label className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-3 block">
              Campos Personalizados
            </Label>
            <div className="space-y-4">
              {customFields.map((field, index) => (
                <div key={field.id} className="border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-3 bg-white dark:bg-gray-800">
                  {/* Header del campo */}
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="Nombre del campo (ej: Ocupación, Estado civil)"
                      value={field.name}
                      onChange={(e) => updateCustomField(index, { name: e.target.value })}
                      className="flex-1 mr-2"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeCustomField(index)}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Configuración del campo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Tipo de dato</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) => updateCustomField(index, { type: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Teléfono</SelectItem>
                          <SelectItem value="document_id">Documento</SelectItem>
                          <SelectItem value="address">Dirección</SelectItem>
                          <SelectItem value="name">Nombre</SelectItem>
                          <SelectItem value="age">Edad</SelectItem>
                          <SelectItem value="date">Fecha</SelectItem>
                          <SelectItem value="amount">Monto</SelectItem>
                          <SelectItem value="yes_no">Sí/No</SelectItem>
                          <SelectItem value="custom_text">Texto libre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={field.enabled}
                          onCheckedChange={(checked) => updateCustomField(index, { enabled: !!checked })}
                        />
                        Activo
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(checked) => updateCustomField(index, { required: !!checked })}
                          disabled={!field.enabled}
                        />
                        Obligatorio
                      </label>
                    </div>
                  </div>
                  
                  {/* Instrucción personalizada */}
                  <div>
                    <Label className="text-xs">Instrucción para el agente (opcional)</Label>
                    <Textarea
                      placeholder="Ej: Pregunta por la ocupación del cliente y confirma la respuesta"
                      value={field.instruction || ''}
                      onChange={(e) => updateCustomField(index, { instruction: e.target.value })}
                      rows={2}
                      className="mt-1 text-sm"
                    />
                  </div>
                  
                  {/* Patrón personalizado para extracción */}
                  {field.type === 'custom_text' && (
                    <div>
                      <Label className="text-xs">Patrón de extracción (regex opcional)</Label>
                      <Input
                        placeholder="Ej: (?:trabajo|ocupación).*?([a-zA-Z\s]+)"
                        value={field.pattern || ''}
                        onChange={(e) => updateCustomField(index, { pattern: e.target.value })}
                        className="mt-1 text-sm font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Patrón regex para extraer el valor del transcript. Deja vacío para usar detección automática.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Información de ayuda */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">Cómo funciona la recolección de datos:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Los campos activos se solicitan automáticamente durante la llamada</li>
                <li>Los campos obligatorios deben ser confirmados antes de finalizar</li>
                <li>Los datos recolectados aparecen en el reporte de la llamada</li>
                <li>Puedes usar instrucciones personalizadas para guiar al agente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicFieldsConfig;
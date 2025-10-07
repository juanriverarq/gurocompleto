import React from 'react';
import { Button } from '../shadcn-ui/Default-Ui/button';
import { Input } from '../shadcn-ui/Default-Ui/input';
import { Label } from '../shadcn-ui/Default-Ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shadcn-ui/Default-Ui/select';
import { Textarea } from '../shadcn-ui/Default-Ui/textarea';
import { Icon } from '@iconify/react';
import { Checkbox } from '../shadcn-ui/Default-Ui/checkbox';

interface DecisionCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface DecisionAction {
  action: string;
  parameters: Record<string, any>;
}

interface DecisionPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: DecisionCondition[];
  actions: DecisionAction[];
}

interface DecisionPoliciesConfigProps {
  policies: DecisionPolicy[];
  onPoliciesChange: (policies: DecisionPolicy[]) => void;
}

const DecisionPoliciesConfig: React.FC<DecisionPoliciesConfigProps> = ({
  policies,
  onPoliciesChange
}) => {
  const addPolicy = () => {
    const newPolicy: DecisionPolicy = {
      id: Date.now().toString(),
      name: '',
      description: '',
      enabled: true,
      conditions: [{
        field: 'call_successful',
        operator: 'eq',
        value: true
      }],
      actions: [{
        action: 'send_payment_link',
        parameters: {}
      }]
    };
    onPoliciesChange([...policies, newPolicy]);
  };

  const updatePolicy = (index: number, updates: Partial<DecisionPolicy>) => {
    const updatedPolicies = [...policies];
    updatedPolicies[index] = { ...updatedPolicies[index], ...updates };
    onPoliciesChange(updatedPolicies);
  };

  const removePolicy = (index: number) => {
    const updatedPolicies = policies.filter((_, i) => i !== index);
    onPoliciesChange(updatedPolicies);
  };

  const addCondition = (policyIndex: number) => {
    const newCondition: DecisionCondition = {
      field: 'call_successful',
      operator: 'eq',
      value: true
    };
    const updatedPolicies = [...policies];
    updatedPolicies[policyIndex].conditions.push(newCondition);
    onPoliciesChange(updatedPolicies);
  };

  const updateCondition = (policyIndex: number, conditionIndex: number, updates: Partial<DecisionCondition>) => {
    const updatedPolicies = [...policies];
    updatedPolicies[policyIndex].conditions[conditionIndex] = {
      ...updatedPolicies[policyIndex].conditions[conditionIndex],
      ...updates
    };
    onPoliciesChange(updatedPolicies);
  };

  const removeCondition = (policyIndex: number, conditionIndex: number) => {
    const updatedPolicies = [...policies];
    updatedPolicies[policyIndex].conditions = updatedPolicies[policyIndex].conditions.filter((_, i) => i !== conditionIndex);
    onPoliciesChange(updatedPolicies);
  };

  const getFieldOptions = () => [
    { value: 'call_successful', label: 'Llamada exitosa' },
    { value: 'duration_seconds', label: 'Duración (segundos)' },
    { value: 'cost_total_cop', label: 'Costo total (COP)' },
    { value: 'collected_data.email', label: 'Email recolectado' },
    { value: 'collected_data.document_id', label: 'Documento recolectado' },
    { value: 'collected_data.address', label: 'Dirección recolectada' }
  ];

  const getOperatorOptions = () => [
    { value: 'eq', label: 'Igual a' },
    { value: 'gte', label: 'Mayor o igual que' },
    { value: 'lte', label: 'Menor o igual que' },
    { value: 'exists', label: 'Existe' }
  ];

  const getActionOptions = () => [
    { value: 'send_payment_link', label: 'Enviar enlace de pago' },
    { value: 'send_custom_message', label: 'Enviar mensaje personalizado' },
    { value: 'mark_as_priority', label: 'Marcar como prioritario' },
    { value: 'schedule_followup', label: 'Programar seguimiento' }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <Label className="text-sm font-medium">Reglas de Decisión Automáticas</Label>
          <p className="text-xs text-gray-500 mt-1">Define qué acciones tomar basado en el resultado de la llamada</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addPolicy}
        >
          <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" />
          Agregar Regla
        </Button>
      </div>
      
      <div className="space-y-4">
        {policies.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Icon icon="solar:settings-minimalistic-outline" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay reglas de decisión configuradas</p>
            <p className="text-xs">Agrega reglas para automatizar acciones post-llamada</p>
          </div>
        ) : (
          policies.map((policy, policyIndex) => (
            <div key={policy.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-white dark:bg-gray-800">
              {/* Header de la política */}
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Nombre de la regla (ej: Enviar pago si llamada exitosa)"
                    value={policy.name}
                    onChange={(e) => updatePolicy(policyIndex, { name: e.target.value })}
                    className="font-medium"
                  />
                  <Textarea
                    placeholder="Descripción de la regla"
                    value={policy.description}
                    onChange={(e) => updatePolicy(policyIndex, { description: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <label className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={policy.enabled}
                      onCheckedChange={(checked) => updatePolicy(policyIndex, { enabled: !!checked })}
                    />
                    Activa
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removePolicy(policyIndex)}
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Condiciones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium">Condiciones (SI...)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addCondition(policyIndex)}
                  >
                    <Icon icon="solar:add-circle-outline" className="w-3 h-3 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {policy.conditions.map((condition, conditionIndex) => (
                    <div key={conditionIndex} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <Select
                        value={condition.field}
                        onValueChange={(value) => updateCondition(policyIndex, conditionIndex, { field: value })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getFieldOptions().map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(policyIndex, conditionIndex, { operator: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorOptions().map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Input
                        placeholder="Valor"
                        value={condition.value.toString()}
                        onChange={(e) => {
                          let value: string | number | boolean = e.target.value;
                          // Convertir tipos automáticamente
                          if (condition.field === 'call_successful') {
                            value = e.target.value === 'true';
                          } else if (condition.field === 'duration_seconds' || condition.field === 'cost_total_cop') {
                            value = parseFloat(e.target.value) || 0;
                          }
                          updateCondition(policyIndex, conditionIndex, { value });
                        }}
                        className="flex-1"
                      />
                      
                      {policy.conditions.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeCondition(policyIndex, conditionIndex)}
                        >
                          <Icon icon="solar:close-circle-outline" className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Acciones (ENTONCES...)</Label>
                <div className="space-y-2">
                  {policy.actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <Select
                        value={action.action}
                        onValueChange={(value) => {
                          const updatedPolicies = [...policies];
                          updatedPolicies[policyIndex].actions[actionIndex] = {
                            ...action,
                            action: value,
                            parameters: {} // Reset parameters when action changes
                          };
                          onPoliciesChange(updatedPolicies);
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getActionOptions().map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {action.action === 'send_custom_message' && (
                        <Input
                          placeholder="Mensaje personalizado"
                          value={action.parameters.message || ''}
                          onChange={(e) => {
                            const updatedPolicies = [...policies];
                            updatedPolicies[policyIndex].actions[actionIndex].parameters = {
                              ...action.parameters,
                              message: e.target.value
                            };
                            onPoliciesChange(updatedPolicies);
                          }}
                          className="flex-1"
                        />
                      )}
                      
                      {action.action === 'schedule_followup' && (
                        <Input
                          type="number"
                          placeholder="Días"
                          value={action.parameters.days || ''}
                          onChange={(e) => {
                            const updatedPolicies = [...policies];
                            updatedPolicies[policyIndex].actions[actionIndex].parameters = {
                              ...action.parameters,
                              days: parseInt(e.target.value) || 1
                            };
                            onPoliciesChange(updatedPolicies);
                          }}
                          className="w-20"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Información de ayuda */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Icon icon="solar:lightbulb-bold" className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Ejemplos de reglas de decisión:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><strong>SI</strong> llamada exitosa = verdadero <strong>ENTONCES</strong> enviar enlace de pago</li>
                <li><strong>SI</strong> duración ≥ 60 segundos <strong>ENTONCES</strong> marcar como prioritario</li>
                <li><strong>SI</strong> email recolectado existe <strong>ENTONCES</strong> enviar mensaje personalizado</li>
                <li><strong>SI</strong> costo total ≥ 5000 COP <strong>ENTONCES</strong> programar seguimiento</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecisionPoliciesConfig;
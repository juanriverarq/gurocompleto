import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Icon } from '@iconify/react';

// ==================== TIPOS ====================

interface NodeData {
  label: string;
  config?: Record<string, any>;
  [key: string]: any;
}

interface CustomNodeProps {
  data: NodeData;
  selected?: boolean;
}

// ==================== ESTILOS COMUNES ====================

const nodeStyles = {
  start: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-400', icon: 'text-green-600', iconBg: 'bg-green-100' },
  message: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-400', icon: 'text-blue-600', iconBg: 'bg-blue-100' },
  question: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-400', icon: 'text-purple-600', iconBg: 'bg-purple-100' },
  input: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-400', icon: 'text-cyan-600', iconBg: 'bg-cyan-100' },
  condition: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-400', icon: 'text-orange-600', iconBg: 'bg-orange-100' },
  action: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-400', icon: 'text-yellow-600', iconBg: 'bg-yellow-100' },
  ai_response: { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-400', icon: 'text-pink-600', iconBg: 'bg-pink-100' },
  transfer: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-400', icon: 'text-red-600', iconBg: 'bg-red-100' },
  delay: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-400', icon: 'text-gray-600', iconBg: 'bg-gray-100' },
  end: { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-400', icon: 'text-slate-600', iconBg: 'bg-slate-100' },
};

const nodeIcons = {
  start: 'solar:play-circle-bold',
  message: 'solar:chat-round-dots-bold',
  question: 'solar:question-circle-bold',
  input: 'solar:text-field-bold',
  condition: 'solar:branching-paths-up-bold',
  action: 'solar:bolt-bold',
  ai_response: 'solar:magic-stick-3-bold',
  transfer: 'solar:user-hand-up-bold',
  delay: 'solar:clock-circle-bold',
  end: 'solar:stop-circle-bold',
};

// ==================== NODO BASE ====================

const BaseNodeWrapper: React.FC<{
  type: keyof typeof nodeStyles;
  label: string;
  children?: React.ReactNode;
  selected?: boolean;
  hasInput?: boolean;
  hasOutput?: boolean;
  hasMultipleOutputs?: boolean;
}> = ({ type, label, children, selected, hasInput = true, hasOutput = true, hasMultipleOutputs = false }) => {
  const style = nodeStyles[type];
  const icon = nodeIcons[type];

  return (
    <div
      className={`
        min-w-[200px] max-w-[280px] rounded-xl border-2 shadow-md transition-all
        ${style.bg} ${style.border}
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''}
        hover:shadow-lg
      `}
    >
      {/* Input Handle */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white dark:!border-gray-800 !-top-1.5"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className={`p-1.5 rounded-lg ${style.iconBg} dark:bg-opacity-30`}>
          <Icon icon={icon} className={style.icon} width={18} />
        </div>
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          {label}
        </span>
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}

      {/* Output Handle(s) */}
      {hasOutput && !hasMultipleOutputs && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white dark:!border-gray-800 !-bottom-1.5"
        />
      )}

      {/* Multiple outputs for condition nodes */}
      {hasMultipleOutputs && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-gray-800 !-bottom-1.5 !left-1/4"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-800 !-bottom-1.5 !left-3/4"
          />
        </>
      )}
    </div>
  );
};

// ==================== NODOS ESPECÍFICOS ====================

export const StartNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="start" label={data.label || 'Inicio'} selected={selected} hasInput={false}>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Punto de inicio del flujo
    </p>
  </BaseNodeWrapper>
));

export const MessageNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="message" label={data.label || 'Mensaje'} selected={selected}>
    {data.config?.text ? (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
        {data.config.text}
      </div>
    ) : (
      <p className="text-xs text-gray-400 italic">Sin mensaje configurado</p>
    )}
  </BaseNodeWrapper>
));

export const QuestionNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="question" label={data.label || 'Pregunta'} selected={selected}>
    {data.config?.text && (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
        {data.config.text}
      </div>
    )}
    {data.config?.buttons && data.config.buttons.length > 0 ? (
      <div className="space-y-1">
        {data.config.buttons.slice(0, 3).map((btn: any, i: number) => (
          <div key={i} className="bg-purple-100 dark:bg-purple-900/30 rounded px-2 py-1 text-xs text-purple-700 dark:text-purple-300">
            {btn.text}
          </div>
        ))}
        {data.config.buttons.length > 3 && (
          <p className="text-xs text-gray-400">+{data.config.buttons.length - 3} más</p>
        )}
      </div>
    ) : (
      <p className="text-xs text-gray-400 italic">Sin opciones configuradas</p>
    )}
  </BaseNodeWrapper>
));

export const InputNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="input" label={data.label || 'Entrada'} selected={selected}>
    <div className="space-y-1">
      {data.config?.variable_name && (
        <div className="flex items-center gap-1">
          <Icon icon="solar:code-bold" className="text-cyan-600" width={12} />
          <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400">
            @{data.config.variable_name}
          </span>
        </div>
      )}
      {data.config?.validation && (
        <p className="text-xs text-gray-500">Validación: {data.config.validation}</p>
      )}
    </div>
  </BaseNodeWrapper>
));

export const ConditionNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="condition" label={data.label || 'Condición'} selected={selected} hasMultipleOutputs>
    <div className="space-y-1">
      {data.config?.condition_type && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {data.config.condition_type}: {data.config.condition_value}
        </p>
      )}
      <div className="flex justify-between text-xs mt-2">
        <span className="text-green-600">✓ Sí</span>
        <span className="text-red-600">✗ No</span>
      </div>
    </div>
  </BaseNodeWrapper>
));

export const ActionNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="action" label={data.label || 'Acción'} selected={selected}>
    {data.config?.action_type ? (
      <div className="flex items-center gap-1">
        <Icon icon="solar:bolt-bold" className="text-yellow-600" width={12} />
        <span className="text-xs text-gray-700 dark:text-gray-300">
          {data.config.action_type}
        </span>
      </div>
    ) : (
      <p className="text-xs text-gray-400 italic">Sin acción configurada</p>
    )}
  </BaseNodeWrapper>
));

export const AIResponseNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="ai_response" label={data.label || 'Respuesta IA'} selected={selected}>
    <div className="flex items-center gap-2">
      <Icon icon="solar:magic-stick-3-bold" className="text-pink-500" width={16} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        Genera respuesta con IA
      </span>
    </div>
  </BaseNodeWrapper>
));

export const TransferNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="transfer" label={data.label || 'Transferir'} selected={selected} hasOutput={false}>
    {data.config?.transfer_to_user_id ? (
      <div className="flex items-center gap-1">
        <Icon icon="solar:user-check-bold" className="text-red-600" width={12} />
        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
          {data.config.transfer_to_user_name || data.config.transfer_to}
        </span>
      </div>
    ) : data.config?.transfer_to ? (
      <div className="flex items-center gap-1">
        <Icon icon="solar:user-bold" className="text-red-600" width={12} />
        <span className="text-xs text-gray-700 dark:text-gray-300">
          {data.config.transfer_to}
        </span>
      </div>
    ) : (
      <p className="text-xs text-gray-400 italic">Transferir a agente humano</p>
    )}
  </BaseNodeWrapper>
));

export const DelayNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="delay" label={data.label || 'Espera'} selected={selected}>
    <div className="flex items-center gap-1">
      <Icon icon="solar:clock-circle-bold" className="text-gray-600" width={12} />
      <span className="text-xs text-gray-700 dark:text-gray-300">
        {data.config?.delay_ms ? `${data.config.delay_ms}ms` : '1000ms'}
      </span>
    </div>
  </BaseNodeWrapper>
));

export const EndNode: React.FC<CustomNodeProps> = memo(({ data, selected }) => (
  <BaseNodeWrapper type="end" label={data.label || 'Fin'} selected={selected} hasOutput={false}>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Finaliza el flujo
    </p>
  </BaseNodeWrapper>
));

// ==================== EXPORTAR TIPOS DE NODOS ====================

export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  question: QuestionNode,
  input: InputNode,
  condition: ConditionNode,
  action: ActionNode,
  ai_response: AIResponseNode,
  transfer: TransferNode,
  delay: DelayNode,
  end: EndNode,
};

export default nodeTypes;

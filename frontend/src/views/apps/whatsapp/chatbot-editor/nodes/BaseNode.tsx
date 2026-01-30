import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Icon } from '@iconify/react';

export interface BaseNodeData {
  label: string;
  icon: string;
  color: string;
  config?: Record<string, any>;
  onEdit?: () => void;
  onDelete?: () => void;
}

const colorClasses: Record<string, { bg: string; border: string; icon: string }> = {
  green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', icon: 'text-green-600' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-700', icon: 'text-purple-600' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-300 dark:border-cyan-700', icon: 'text-cyan-600' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', icon: 'text-orange-600' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-300 dark:border-yellow-700', icon: 'text-yellow-600' },
  pink: { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', icon: 'text-pink-600' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-700', icon: 'text-red-600' },
  gray: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', icon: 'text-gray-600' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-600', icon: 'text-slate-600' },
};

const BaseNode: React.FC<NodeProps<BaseNodeData>> = ({ data, selected }) => {
  const colors = colorClasses[data.color] || colorClasses.gray;

  return (
    <div
      className={`
        min-w-[180px] rounded-lg border-2 shadow-sm transition-all
        ${colors.bg} ${colors.border}
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className={`p-1.5 rounded-md ${colors.bg}`}>
          <Icon icon={data.icon} className={colors.icon} width={18} />
        </div>
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {data.label}
        </span>
      </div>

      {/* Content slot - children will be rendered here */}
      {data.config && Object.keys(data.config).length > 0 && (
        <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
          {data.config.text && (
            <p className="line-clamp-2">{data.config.text}</p>
          )}
          {data.config.variable_name && (
            <p className="font-mono text-blue-600">@{data.config.variable_name}</p>
          )}
          {data.config.delay_ms && (
            <p>{data.config.delay_ms}ms</p>
          )}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  );
};

export default memo(BaseNode);

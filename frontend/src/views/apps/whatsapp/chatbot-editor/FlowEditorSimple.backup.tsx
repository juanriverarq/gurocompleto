import React, { useState, useCallback, useEffect, useMemo, useContext } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
  Handle,
  Position,
  EdgeLabelRenderer,
  getBezierPath,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Modal, TextInput, Textarea, Select, Badge, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import chatbotService, { 
  Chatbot, 
  ChatbotFlow, 
  NodeType, 
  NodeConfig,
} from '../../../../services/chatbotService';
import ChatbotSettings from './ChatbotSettings';
import guroToast from 'src/components/GuroToast/GuroToast';
import ChatbotAnalyticsPanel from './ChatbotAnalyticsPanel';
import { useEmpleadosBroker } from '../../../../hooks/useAdminCrudApi';
import { CustomizerContext } from '../../../../context/CustomizerContext';

// ==================== DARK MODE HOOK ====================
const useIsDark = () => {
  const customizer = useContext(CustomizerContext);
  return customizer?.activeMode === 'dark';
};

// ==================== TIPOS ====================

interface NodePaletteItem {
  type: NodeType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const nodePalette: NodePaletteItem[] = [
  { type: 'start', label: 'Inicio', icon: 'solar:play-circle-bold', color: 'green', description: 'Punto de inicio del flujo' },
  { type: 'message', label: 'Mensaje', icon: 'solar:chat-round-dots-bold', color: 'blue', description: 'Enviar mensaje de texto' },
  { type: 'options', label: 'Opciones', icon: 'solar:list-check-bold', color: 'purple', description: 'Menú con opciones enlazables' },
  { type: 'input', label: 'Entrada', icon: 'solar:text-field-bold', color: 'cyan', description: 'Capturar respuesta del usuario' },
  { type: 'condition', label: 'Condición', icon: 'solar:branching-paths-up-bold', color: 'orange', description: 'Bifurcación Sí/No' },
  { type: 'action', label: 'Acción', icon: 'solar:bolt-bold', color: 'yellow', description: 'Ejecutar acción automática' },
  { type: 'ai_response', label: 'IA', icon: 'solar:magic-stick-3-bold', color: 'pink', description: 'Respuesta generada por IA' },
  { type: 'transfer', label: 'Transferir', icon: 'solar:user-hand-up-bold', color: 'red', description: 'Transferir a agente humano' },
  { type: 'delay', label: 'Espera', icon: 'solar:clock-circle-bold', color: 'gray', description: 'Pausar antes de continuar' },
  { type: 'end', label: 'Fin', icon: 'solar:stop-circle-bold', color: 'slate', description: 'Finalizar conversación' },
  { type: 'policy_lookup', label: 'Consultar Póliza', icon: 'solar:shield-check-bold', color: 'teal', description: 'Consulta de pólizas por documento' },
  { type: 'add_tag', label: 'Agregar Etiqueta', icon: 'solar:tag-horizontal-bold', color: 'emerald', description: 'Agregar etiqueta a la conversación' },
  { type: 'remove_tag', label: 'Quitar Etiqueta', icon: 'solar:tag-horizontal-bold-duotone', color: 'rose', description: 'Quitar etiqueta de la conversación' },
];

const nodeStyles: Record<string, { accent: string; accentLight: string; accentDark: string }> = {
  start: { accent: '#22c55e', accentLight: '#dcfce7', accentDark: '#16a34a' },
  message: { accent: '#3b82f6', accentLight: '#dbeafe', accentDark: '#2563eb' },
  options: { accent: '#a855f7', accentLight: '#f3e8ff', accentDark: '#9333ea' },
  input: { accent: '#06b6d4', accentLight: '#cffafe', accentDark: '#0891b2' },
  condition: { accent: '#f97316', accentLight: '#ffedd5', accentDark: '#ea580c' },
  action: { accent: '#eab308', accentLight: '#fef9c3', accentDark: '#ca8a04' },
  ai_response: { accent: '#ec4899', accentLight: '#fce7f3', accentDark: '#db2777' },
  transfer: { accent: '#ef4444', accentLight: '#fee2e2', accentDark: '#dc2626' },
  delay: { accent: '#6b7280', accentLight: '#f3f4f6', accentDark: '#4b5563' },
  end: { accent: '#64748b', accentLight: '#f1f5f9', accentDark: '#475569' },
  policy_lookup: { accent: '#14b8a6', accentLight: '#ccfbf1', accentDark: '#0d9488' },
  add_tag: { accent: '#10b981', accentLight: '#d1fae5', accentDark: '#059669' },
  remove_tag: { accent: '#f43f5e', accentLight: '#ffe4e6', accentDark: '#e11d48' },
};

const nodeIcons: Record<string, string> = {
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
  policy_lookup: 'solar:shield-check-bold',
  add_tag: 'solar:tag-horizontal-bold',
  remove_tag: 'solar:tag-horizontal-bold-duotone',
};

// ==================== CUSTOM NODE WITH HOVER ACTIONS ====================

const GuroFlowNode: React.FC<NodeProps> = ({ data, id, selected }) => {
  const [hovered, setHovered] = useState(false);
  const dark = useIsDark();
  const nodeType = (data as any).nodeType || 'message';
  const nodeName = (data as any).nodeName || 'Nodo';
  const config = (data as any).config || {};
  const style = nodeStyles[nodeType] || nodeStyles.message;
  const icon = nodeIcons[nodeType] || 'solar:widget-bold';

  const onEdit = (data as any).onEdit;
  const onDelete = (data as any).onDelete;
  const onDuplicate = (data as any).onDuplicate;
  const activeUsers = (data as any).activeUsers || 0;
  const nodeIndex = (data as any).nodeIndex;

  const hasOptionHandles = (nodeType === 'options' || nodeType === 'question') && config.options?.length > 0;
  const hasConditionHandles = nodeType === 'condition';

  const indexLabel = nodeIndex !== undefined ? String.fromCharCode(65 + nodeIndex) : '';

  // Dark/light palette
  const cardBg = dark ? '#161616' : '#fff';
  const cardBorder = dark ? '#ffffff10' : '#e5e7eb';
  const handleBg = dark ? '#1e1e1e' : '#fff';
  const textPrimary = dark ? '#e5e7eb' : '#1f2937';
  const textSecondary = dark ? '#9ca3af' : '#6b7280';
  const textTertiary = dark ? '#6b7280' : '#9ca3af';
  const divider = dark ? '#ffffff08' : '#f3f4f6';
  const mediaBg = dark ? '#1e1e1e' : '#f9fafb';
  const mediaBorder = dark ? '#ffffff08' : '#f3f4f6';
  const iconBg = dark ? `${style.accent}15` : style.accentLight;
  const hoverBarBg = dark ? '#1a1a1a' : '#fff';
  const hoverBarBorder = dark ? '#ffffff10' : '#e5e7eb';

  const getContentPreview = () => {
    if (nodeType === 'start') return config.keywords ? `Keywords: ${config.keywords}` : 'Punto de inicio del flujo';
    if (nodeType === 'message') return config.text || null;
    if (nodeType === 'input') return config.variable_name ? `Variable: @${config.variable_name}` : null;
    if (nodeType === 'ai_response') return 'Genera respuesta con IA';
    if (nodeType === 'transfer') return config.transfer_to_user_name || config.transfer_to || 'Transferir a agente';
    if (nodeType === 'delay') return `Esperar ${config.delay_seconds || 3} segundos`;
    if (nodeType === 'end') return config.goodbye_message || 'Finaliza el flujo';
    if (nodeType === 'condition') return config.variable ? `${config.variable} ${config.condition_type || '='} ${config.condition_value || '?'}` : null;
    if (nodeType === 'action') return config.action_type || null;
    return null;
  };

  const preview = getContentPreview();

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: cardBg,
        border: selected ? `2px solid ${style.accent}` : `1px solid ${cardBorder}`,
        borderRadius: '12px',
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? `0 0 0 3px ${style.accent}20, 0 4px 16px rgba(0,0,0,${dark ? '0.3' : '0.08'})`
          : dark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Target handle (left) */}
      <Handle type="target" position={Position.Left} style={{ background: handleBg, width: 10, height: 10, border: `2px solid ${style.accent}`, boxShadow: `0 1px 3px rgba(0,0,0,${dark ? '0.3' : '0.1'})` }} />

      {/* Default source handle (right) */}
      {!hasOptionHandles && !hasConditionHandles && (
        <Handle type="source" position={Position.Right} style={{ background: handleBg, width: 10, height: 10, border: `2px solid ${style.accent}`, boxShadow: `0 1px 3px rgba(0,0,0,${dark ? '0.3' : '0.1'})` }} />
      )}

      {/* Node header with colored icon badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px 8px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon icon={icon} width={17} style={{ color: style.accent }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {indexLabel && (
              <span style={{ color: style.accent, fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>{indexLabel}.</span>
            )}
            <span style={{ color: textPrimary, fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeName}</span>
          </div>
          {activeUsers > 0 && (
            <span style={{
              background: dark ? '#16a34a20' : '#dcfce7', color: '#16a34a',
              fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', lineHeight: '14px', marginTop: '2px', display: 'inline-block',
            }} title={`${activeUsers} usuario${activeUsers > 1 ? 's' : ''} en este paso`}>
              {activeUsers} activo{activeUsers > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Content preview */}
      {preview && (
        <div style={{ padding: '0 14px 6px', fontSize: '12px', color: textSecondary, lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
          {preview}
        </div>
      )}

      {/* Media preview for message nodes */}
      {nodeType === 'message' && config.media_url && (
        <div style={{ padding: '0 14px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: mediaBg, borderRadius: '6px', border: `1px solid ${mediaBorder}` }}>
            <Icon icon={config.media_type === 'image' ? 'solar:gallery-bold' : config.media_type === 'video' ? 'solar:video-frame-bold' : 'solar:file-bold'} width={14} style={{ color: style.accent }} />
            <span style={{ fontSize: '10px', color: textTertiary }}>{config.media_type || 'Archivo'}</span>
          </div>
        </div>
      )}

      {/* Per-option source handles for options nodes */}
      {hasOptionHandles && (
        <div style={{ borderTop: `1px solid ${divider}`, padding: '4px 0 6px' }}>
          {config.options.map((opt: any, idx: number) => (
            <div key={opt.id || idx} className="relative flex items-center" style={{ padding: '4px 14px', minHeight: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                <span style={{ color: textTertiary, fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>§ {idx + 1}</span>
                <span style={{ color: dark ? '#d1d5db' : '#374151', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.text || `Opción ${idx + 1}`}
                </span>
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id={`opt-${idx}`}
                style={{
                  background: handleBg, width: 9, height: 9, border: '2px solid #a855f7',
                  right: -5, top: '50%', position: 'absolute', boxShadow: `0 1px 3px rgba(0,0,0,${dark ? '0.3' : '0.1'})`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Per-branch source handles for condition nodes */}
      {hasConditionHandles && (
        <div style={{ borderTop: `1px solid ${divider}`, padding: '4px 0 6px' }}>
          <div className="relative flex items-center" style={{ padding: '4px 14px', minHeight: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ color: dark ? '#4ade80' : '#16a34a', fontSize: '12px', fontWeight: 500 }}>Sí</span>
            </div>
            <Handle type="source" position={Position.Right} id="condition-true"
              style={{ background: handleBg, width: 9, height: 9, border: '2px solid #22c55e', right: -5, top: '50%', position: 'absolute', boxShadow: `0 1px 3px rgba(0,0,0,${dark ? '0.3' : '0.1'})` }} />
          </div>
          <div className="relative flex items-center" style={{ padding: '4px 14px', minHeight: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ color: dark ? '#f87171' : '#dc2626', fontSize: '12px', fontWeight: 500 }}>No</span>
            </div>
            <Handle type="source" position={Position.Right} id="condition-false"
              style={{ background: handleBg, width: 9, height: 9, border: '2px solid #ef4444', right: -5, top: '50%', position: 'absolute', boxShadow: `0 1px 3px rgba(0,0,0,${dark ? '0.3' : '0.1'})` }} />
          </div>
        </div>
      )}

      {/* Invisible hover bridge */}
      {hovered && <div className="absolute -top-10 left-0 right-0 h-10" style={{ zIndex: 9 }} />}

      {/* Hover action bar */}
      {hovered && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-lg border shadow-lg"
          style={{ background: hoverBarBg, borderColor: hoverBarBorder, zIndex: 10 }}
        >
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(id); }}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all active:scale-90 ${dark ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`} title="Editar">
              <Icon icon="solar:pen-bold" width={13} />
            </button>
          )}
          {onDuplicate && (
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(id); }}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all active:scale-90 ${dark ? 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title="Duplicar">
              <Icon icon="solar:copy-bold" width={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all active:scale-90 ${dark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`} title="Eliminar">
              <Icon icon="solar:trash-bin-trash-bold" width={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== CUSTOM EDGE WITH DELETE BUTTON ====================

const DeletableEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius, markerEnd,
}) => {
  const [hovered, setHovered] = useState(false);
  const dark = useIsDark();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  // In dark mode, use darker label backgrounds
  const labelBgColor = (() => {
    const lightBg = (labelBgStyle as any)?.fill || '#f5f3ff';
    if (!dark) return lightBg;
    // Map light backgrounds to dark equivalents
    if (lightBg === '#f5f3ff') return '#a855f715'; // purple
    if (lightBg === '#f0fdf4') return '#22c55e15'; // green
    if (lightBg === '#fef2f2') return '#ef444415'; // red
    return '#ffffff08';
  })();

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wider path for easier hover */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />
      {/* Visible path */}
      <path d={edgePath} fill="none" stroke={(style as any)?.stroke || (dark ? '#ffffff15' : '#c4c9d4')} strokeWidth={(style as any)?.strokeWidth || 1.5} className="animated" markerEnd={markerEnd as string} />
      <EdgeLabelRenderer>
        {label && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              fontSize: (labelStyle as any)?.fontSize || 10,
              color: (labelStyle as any)?.fill || '#8b5cf6',
              fontWeight: (labelStyle as any)?.fontWeight || 500,
              background: labelBgColor,
              padding: `${(labelBgPadding as any)?.[1] || 3}px ${(labelBgPadding as any)?.[0] || 6}px`,
              borderRadius: (labelBgBorderRadius as number) || 4,
            }}
          >
            {label as string}
          </div>
        )}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px,${(sourceY + targetY) / 2 - 16}px)`,
              pointerEvents: 'all',
            }}
          >
            <button
              className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-all hover:scale-110 active:scale-90"
              onClick={(e) => {
                e.stopPropagation();
                const event = new CustomEvent('delete-edge', { detail: { edgeId: id } });
                window.dispatchEvent(event);
              }}
              title="Eliminar conexión"
            >
              <Icon icon="solar:close-circle-bold" width={12} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </g>
  );
};

const customNodeTypes = { guroNode: GuroFlowNode };
const customEdgeTypes = { deletable: DeletableEdge };

// ==================== COMPONENTE PRINCIPAL ====================

const FlowEditorContent: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatbotId = searchParams.get('id');
  const flowId = searchParams.get('flow');

  // Estados
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [currentFlow, setCurrentFlow] = useState<ChatbotFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [activeTab, setActiveTab] = useState<'flows' | 'settings' | 'analytics'>('flows');
  const [showPalette, setShowPalette] = useState(false);
  const [nodeSessionCounts, setNodeSessionCounts] = useState<Record<number, number>>({});

  // Modales

  // Cargar datos
  useEffect(() => {
    if (chatbotId) {
      loadChatbot();
    }
  }, [chatbotId, flowId]);

  const loadChatbot = async () => {
    try {
      setLoading(true);
      const result = await chatbotService.getChatbot(Number(chatbotId));
      
      if (result.success && result.data) {
        setChatbot(result.data);
        
        if (result.data.flows && result.data.flows.length > 0) {
          const targetFlow = flowId 
            ? result.data.flows.find(f => f.id === Number(flowId))
            : result.data.flows.find(f => f.is_default) || result.data.flows[0];
          
          if (targetFlow) {
            setCurrentFlow(targetFlow);
            loadFlowNodes(targetFlow);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando chatbot:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFlowNodes = (flow: ChatbotFlow) => {
    if (!flow.nodes || flow.nodes.length === 0) {
      setNodes([{
        id: 'start-1',
        type: 'guroNode',
        position: { x: 250, y: 50 },
        data: { 
          nodeName: 'Inicio',
          nodeType: 'start',
          config: {},
        },
      }]);
      setEdges([]);
      return;
    }

    const flowNodes: Node[] = flow.nodes.map(node => {
      const name = node.name || getNodeLabel(node.node_type);
      return {
        id: String(node.id),
        type: 'guroNode',
        position: { x: node.position_x, y: node.position_y },
        data: { 
          nodeName: name,
          nodeType: node.node_type,
          config: node.config || {},
        },
      };
    });

    // Edges from next_node_id (linear connections)
    const linearEdges: Edge[] = flow.nodes
      .filter(node => node.next_node_id)
      .map(node => ({
        id: `e${node.id}-${node.next_node_id}`,
        source: String(node.id),
        target: String(node.next_node_id),
        animated: true,
        style: { stroke: '#c4c9d4', strokeWidth: 1.5 },
      }));

    // Edges from options[].next_node_id (branching connections)
    const optionEdges: Edge[] = flow.nodes.flatMap(node => {
      const options = node.config?.options || [];
      return options
        .filter((opt: any) => opt.next_node_id)
        .map((opt: any, idx: number) => ({
          id: `e${node.id}-opt${idx}-${opt.next_node_id}`,
          source: String(node.id),
          sourceHandle: `opt-${idx}`,
          target: String(opt.next_node_id),
          animated: true,
          label: opt.text || `Opción ${idx + 1}`,
          style: { stroke: '#a855f7', strokeWidth: 1.5 },
          labelStyle: { fontSize: 10, fill: '#8b5cf6', fontWeight: 500 },
          labelBgStyle: { fill: '#f5f3ff', fillOpacity: 0.9 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        }));
    });

    // Edges from condition true_node_id / false_node_id
    const conditionEdges: Edge[] = flow.nodes.flatMap(node => {
      const config = node.config || {};
      const edges: Edge[] = [];
      if (config.true_node_id) {
        edges.push({
          id: `e${node.id}-true-${config.true_node_id}`,
          source: String(node.id),
          sourceHandle: 'condition-true',
          target: String(config.true_node_id),
          animated: true,
          label: 'Sí',
          style: { stroke: '#22c55e', strokeWidth: 2 },
          labelStyle: { fontSize: 10, fill: '#22c55e', fontWeight: 600 },
          labelBgStyle: { fill: '#f0fdf4', fillOpacity: 0.9 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
      if (config.false_node_id) {
        edges.push({
          id: `e${node.id}-false-${config.false_node_id}`,
          source: String(node.id),
          sourceHandle: 'condition-false',
          target: String(config.false_node_id),
          animated: true,
          label: 'No',
          style: { stroke: '#ef4444', strokeWidth: 2 },
          labelStyle: { fontSize: 10, fill: '#ef4444', fontWeight: 600 },
          labelBgStyle: { fill: '#fef2f2', fillOpacity: 0.9 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
      return edges;
    });

    setNodes(flowNodes);
    setEdges([...linearEdges, ...optionEdges, ...conditionEdges]);
  };

  const getNodeLabel = (type: NodeType): string => {
    const item = nodePalette.find(n => n.type === type);
    return item?.label || type;
  };

  const onConnect = useCallback((params: Connection) => {
    const sourceHandle = params.sourceHandle || '';
    let edgeStyle: any = { animated: true, style: { stroke: '#c4c9d4', strokeWidth: 1.5 } };

    if (sourceHandle.startsWith('opt-')) {
      // Find the option label from the source node
      const sourceNode = nodes.find(n => n.id === params.source);
      const optIdx = parseInt(sourceHandle.replace('opt-', ''));
      const optText = (sourceNode?.data as any)?.config?.options?.[optIdx]?.text || `Opción ${optIdx + 1}`;
      edgeStyle = {
        animated: true,
        label: optText,
        style: { stroke: '#a855f7', strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: '#8b5cf6', fontWeight: 500 },
        labelBgStyle: { fill: '#f5f3ff', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    } else if (sourceHandle === 'condition-true') {
      edgeStyle = {
        animated: true,
        label: 'Sí',
        style: { stroke: '#22c55e', strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: '#22c55e', fontWeight: 600 },
        labelBgStyle: { fill: '#f0fdf4', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    } else if (sourceHandle === 'condition-false') {
      edgeStyle = {
        animated: true,
        label: 'No',
        style: { stroke: '#ef4444', strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: '#ef4444', fontWeight: 600 },
        labelBgStyle: { fill: '#fef2f2', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    }

    setEdges((eds) => addEdge({ ...params, ...edgeStyle }, eds));
  }, [setEdges, nodes]);

  // Listen for edge delete events from custom edge component
  useEffect(() => {
    const handler = (e: Event) => {
      const edgeId = (e as CustomEvent).detail?.edgeId;
      if (edgeId) setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    };
    window.addEventListener('delete-edge', handler);
    return () => window.removeEventListener('delete-edge', handler);
  }, [setEdges]);

  // Fetch session counts per node for the current chatbot
  useEffect(() => {
    if (!chatbotId) return;
    const fetchCounts = async () => {
      try {
        const data = await chatbotService.getChatbotAnalytics(Number(chatbotId), 'all');
        if (data?.node_stats) {
          const counts: Record<number, number> = {};
          data.node_stats.forEach((ns: any) => {
            if (ns.active_users > 0) counts[ns.node_id] = ns.active_users;
          });
          setNodeSessionCounts(counts);
        }
      } catch {}
    };
    fetchCounts();
  }, [chatbotId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) return;

      const position = {
        x: event.clientX - 300,
        y: event.clientY - 100,
      };

      const name = getNodeLabel(type);
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'guroNode',
        position,
        data: { 
          nodeName: name,
          nodeType: type,
          config: getDefaultConfig(type),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const getDefaultConfig = (type: NodeType): NodeConfig => {
    switch (type) {
      case 'message':
        return { text: '' };
      case 'question':
        return { text: '', buttons: [] };
      case 'input':
        return { variable_name: '', validation: '' };
      case 'condition':
        return { condition_type: 'equals', condition_value: '' };
      case 'action':
        return { action_type: 'set_variable', action_config: {} };
      case 'delay':
        return { delay_ms: 1000 };
      case 'transfer':
        return { transfer_to: '' };
      case 'policy_lookup':
        return { 
          validation_field: 'email', 
          send_documents: true,
          ask_document_message: '',
          ask_validation_message: '',
          no_results_message: '',
          validation_error_message: '',
          success_message: '',
        };
      case 'add_tag':
        return { tag_name: '', tag_color: 'blue' };
      case 'remove_tag':
        return { tag_name: '' };
      default:
        return {};
    }
  };

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNode(node);
    setShowNodeEditor(true);
  }, []);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNode(node);
    setShowNodeEditor(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setShowNodeEditor(false);
    setEditingNode(null);
  }, []);

  const onNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const onEditNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setEditingNode(node);
      setShowNodeEditor(true);
    }
  }, [nodes]);

  const onDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newNode: Node = {
      id: `${(node.data as any).nodeType}-${Date.now()}`,
      type: 'guroNode',
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes]);

  // Inject callbacks and index into nodes so the custom GuroFlowNode can use them
  const nodesWithCallbacks = useMemo(() =>
    nodes.map((node, index) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: onEditNode,
        onDelete: onNodeDelete,
        onDuplicate: onDuplicateNode,
        activeUsers: nodeSessionCounts[Number(node.id)] || 0,
        nodeIndex: index,
      },
    })),
    [nodes, onEditNode, onNodeDelete, onDuplicateNode, nodeSessionCounts]
  );

  // Add 'deletable' type to all edges
  const edgesWithType = useMemo(() =>
    edges.map((edge) => ({ ...edge, type: 'deletable' })),
    [edges]
  );

  const handleSaveFlow = async () => {
    if (!currentFlow || !chatbot) return;

    try {
      setSaving(true);

      // Crear mapa de IDs temporales a índices
      const nodeIdToIndex = new Map<string, number>();
      nodes.forEach((node, index) => {
        nodeIdToIndex.set(node.id, index);
      });

      // Preparar nodos con conexiones
      const nodesToSave = nodes.map((node, index) => {
        const nodeType = (node.data as any).nodeType || 'start';
        const nodeName = (node.data as any).nodeName || getNodeLabel(nodeType as NodeType);
        const config = JSON.parse(JSON.stringify((node.data as any).config || {}));
        
        // Classify outgoing edges by sourceHandle
        const outgoingEdges = edges.filter(e => e.source === node.id);
        
        const linearEdge = outgoingEdges.find(e => 
          !e.sourceHandle || (!e.sourceHandle.startsWith('opt-') && !e.sourceHandle.startsWith('condition-'))
        );
        const nextNodeIndex = linearEdge ? nodeIdToIndex.get(linearEdge.target) : undefined;

        // Map option edges back to options[].next_node_index using sourceHandle
        if (config.options && Array.isArray(config.options)) {
          config.options = config.options.map((opt: any, optIdx: number) => {
            const optEdge = outgoingEdges.find(e => e.sourceHandle === `opt-${optIdx}`);
            return {
              ...opt,
              next_node_index: optEdge ? nodeIdToIndex.get(optEdge.target) : undefined,
            };
          });
        }

        // Map condition edges back to true_node_index / false_node_index
        const trueEdge = outgoingEdges.find(e => e.sourceHandle === 'condition-true');
        const falseEdge = outgoingEdges.find(e => e.sourceHandle === 'condition-false');
        if (trueEdge) config.true_node_index = nodeIdToIndex.get(trueEdge.target);
        if (falseEdge) config.false_node_index = nodeIdToIndex.get(falseEdge.target);

        return {
          temp_id: node.id,
          temp_index: index,
          node_type: nodeType,
          name: nodeName,
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
          config,
          next_node_index: nextNodeIndex,
        };
      });

      console.log('Guardando nodos con conexiones:', nodesToSave);

      const result = await chatbotService.updateNodesBulk(currentFlow.id, nodesToSave);

      if (result.success) {
        // Buscar el nodo de inicio para crear/actualizar triggers
        const startNode = nodes.find(n => (n.data as any).nodeType === 'start');
        if (startNode && chatbot) {
          const startConfig = (startNode.data as any).config || {};
          
          // Crear triggers basados en la configuración del nodo de inicio
          if (startConfig.keywords || startConfig.trigger_first_message) {
            try {
              // Crear trigger de keywords si hay palabras clave
              if (startConfig.keywords) {
                await chatbotService.createTrigger(chatbot.id, {
                  flow_id: currentFlow.id,
                  trigger_type: 'keyword',
                  trigger_value: startConfig.keywords,
                  is_case_sensitive: false,
                  priority: 50,
                });
              }
              
              // Crear trigger de primer mensaje si está activado
              if (startConfig.trigger_first_message) {
                await chatbotService.createTrigger(chatbot.id, {
                  flow_id: currentFlow.id,
                  trigger_type: 'first_message',
                  trigger_value: '',
                  is_case_sensitive: false,
                  priority: 100,
                });
              }
            } catch (triggerError) {
              console.log('Triggers ya existen o error al crear:', triggerError);
            }
          }
        }
        
        guroToast.success('¡Flujo guardado!', 'El flujo se ha guardado correctamente');
        await loadChatbot();
      } else {
        guroToast.error('Error al guardar', result.message || 'Error desconocido');
      }
    } catch (error: any) {
      console.error('Error guardando flujo:', error);
      const errorMsg = error?.response?.data?.errors 
        ? JSON.stringify(error.response.data.errors) 
        : 'Error al guardar el flujo';
      guroToast.error('Error al guardar', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFlow = async () => {
    if (!chatbot || !newFlowName.trim()) return;

    try {
      const result = await chatbotService.createFlow(chatbot.id, {
        name: newFlowName,
        description: '',
        is_default: false,
      });

      if (result.success && result.data) {
        guroToast.success('¡Flujo creado!', `Se ha creado el flujo "${newFlowName}"`);
        setShowNewFlowModal(false);
        setNewFlowName('');
        await loadChatbot();
        navigate(`/apps/whatsapp/chatbots/flujos?id=${chatbot.id}&flow=${result.data.id}`);
      }
    } catch (error) {
      console.error('Error creando flujo:', error);
    }
  };

  const handleUpdateNode = (updatedData: any) => {
    if (!editingNode) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === editingNode.id
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                nodeName: updatedData.label,
                config: updatedData.config,
              } 
            }
          : node
      )
    );
    setShowNodeEditor(false);
    setEditingNode(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="p-6 text-center">
        <Icon icon="solar:bot-bold-duotone" className="mx-auto text-gray-400" width={64} />
        <h2 className="text-xl font-semibold mt-4">Chatbot no encontrado</h2>
        <Button color="light" className="mt-4" onClick={() => navigate('/apps/whatsapp/chatbots')}>
          Volver a Chatbots
        </Button>
      </div>
    );
  }

  const TOOLBAR_NAV: { id: typeof activeTab; icon: string; tip: string }[] = [
    { id: 'flows', icon: 'solar:diagram-up-linear', tip: 'Editor' },
    { id: 'settings', icon: 'solar:settings-linear', tip: 'Configuración' },
    { id: 'analytics', icon: 'solar:chart-2-linear', tip: 'Análisis' },
  ];

  return (
    <div className="h-[calc(100vh-80px)] -mx-2 -mt-2 flex flex-col bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-white overflow-hidden rounded-2xl" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* ── Minimal top bar ── */}
      <div className="flex items-center justify-between px-4 h-11 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.04] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/apps/whatsapp/chatbots')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-90">
            <Icon icon="solar:arrow-left-linear" width={16} />
          </button>
          <div className="flex items-center gap-2">
            <Icon icon="solar:bot-bold-duotone" className="text-emerald-400" width={18} />
            <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">{chatbot.name}</span>
          </div>
          {activeTab === 'flows' && currentFlow && (
            <button onClick={() => setShowFlowSelector(true)} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all">
              <Icon icon="solar:routing-bold" width={12} className="text-emerald-500/60" />
              {currentFlow.name}
              <Icon icon="solar:alt-arrow-down-bold" width={10} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {activeTab === 'flows' && (
            <>
              <button onClick={() => setShowNewFlowModal(true)} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all active:scale-95">
                <Icon icon="solar:add-circle-linear" width={13} className="mr-1 inline" />
                Nuevo Flujo
              </button>
              <button onClick={handleSaveFlow} disabled={saving} className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-bold text-white transition-all active:scale-95 shadow-lg shadow-emerald-600/20">
                {saving ? <Spinner size="xs" className="mr-1 inline" /> : <Icon icon="solar:diskette-bold" width={13} className="mr-1 inline" />}
                Guardar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Pill icon toolbar ── */}
        <div className="w-[52px] shrink-0 flex flex-col items-center pt-4 gap-3">
          {/* Navigation icons */}
          <div className="bg-white dark:bg-[#161616] rounded-2xl py-2.5 px-1.5 flex flex-col items-center gap-1 border border-gray-200 dark:border-white/[0.06] shadow-lg shadow-black/10 dark:shadow-black/40">
            {TOOLBAR_NAV.map((n) => (
              <button key={n.id} onClick={() => setActiveTab(n.id)} title={n.tip}
                className={`group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === n.id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                } active:scale-90`}>
                <Icon icon={n.icon} width={17} />
                <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#222] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">{n.tip}</div>
              </button>
            ))}
          </div>

          {/* Node palette toggle (only in flows tab) */}
          {activeTab === 'flows' && (
            <div className="bg-white dark:bg-[#161616] rounded-2xl py-2.5 px-1.5 flex flex-col items-center gap-1 border border-gray-200 dark:border-white/[0.06] shadow-lg shadow-black/10 dark:shadow-black/40">
              <button onClick={() => setShowPalette(!showPalette)} title="Componentes"
                className={`group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  showPalette ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                } active:scale-90`}>
                <Icon icon="solar:widget-add-linear" width={17} />
                <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#222] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">Componentes</div>
              </button>

              {/* Quick-add node icons */}
              {nodePalette.slice(0, 6).map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', item.type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  title={item.label}
                  className="group relative w-8 h-8 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 active:scale-90"
                >
                  <Icon icon={item.icon} width={15} style={{ color: nodeStyles[item.type]?.accent }} />
                  <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#222] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom actions */}
          <div className="mt-auto mb-4 bg-white dark:bg-[#161616] rounded-2xl py-2.5 px-1.5 flex flex-col items-center gap-1 border border-gray-200 dark:border-white/[0.06] shadow-lg shadow-black/10 dark:shadow-black/40">
            <button onClick={() => navigate('/apps/whatsapp/chatbots')} title="Volver"
              className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 active:scale-90">
              <Icon icon="solar:undo-left-linear" width={17} />
              <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#222] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">Volver</div>
            </button>
          </div>
        </div>

        {/* ── Expandable node palette panel ── */}
        {activeTab === 'flows' && showPalette && (
          <div className="w-[220px] bg-white dark:bg-[#111] border-r border-gray-200 dark:border-white/[0.04] overflow-y-auto shrink-0 transition-all">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Componentes</span>
                <button onClick={() => setShowPalette(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all">
                  <Icon icon="solar:close-circle-linear" width={13} />
                </button>
              </div>
              <p className="text-[9px] text-gray-400 dark:text-gray-600 mb-3">Arrastra al canvas →</p>
              <div className="space-y-1.5">
                {nodePalette.map((item) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', item.type);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] cursor-grab hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.08] transition-all active:cursor-grabbing active:scale-[0.97]"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${nodeStyles[item.type]?.accent}15` }}>
                      <Icon icon={item.icon} width={14} style={{ color: nodeStyles[item.type]?.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-600 truncate">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Main content area (canvas + config sidebar) ── */}
        {activeTab === 'flows' && (
          <>
            <div className="flex-1 bg-[#f8f9fb] dark:bg-[#0a0a0a]">
              <ReactFlow
                nodes={nodesWithCallbacks}
                edges={edgesWithType}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                nodeTypes={customNodeTypes}
                edgeTypes={customEdgeTypes}
                fitView
                snapToGrid
                snapGrid={[20, 20]}
                defaultEdgeOptions={{
                  animated: true,
                  style: { stroke: '#c4c9d4', strokeWidth: 1.5 },
                }}
                style={{ background: 'var(--rf-bg, #f8f9fb)' }}
                className="[--rf-bg:#f8f9fb] dark:[--rf-bg:#0a0a0a] [--rf-dot:rgba(0,0,0,0.06)] dark:[--rf-dot:rgba(255,255,255,0.04)] [--rf-minimap-mask:rgba(0,0,0,0.08)] dark:[--rf-minimap-mask:rgba(0,0,0,0.7)]"
              >
                <Controls
                  position="bottom-right"
                  className="!rounded-xl !overflow-hidden !shadow-lg !border bg-white dark:bg-[#161616] !border-gray-200 dark:!border-white/[0.06] !shadow-black/5 dark:!shadow-black/40 [&>button]:!bg-white dark:[&>button]:!bg-[#161616] [&>button]:!border-gray-200 dark:[&>button]:!border-white/[0.04] [&>button]:!text-gray-500 dark:[&>button]:!text-gray-400 [&>button:hover]:!bg-gray-50 dark:[&>button:hover]:!bg-white/5 [&>button:hover]:!text-gray-800 dark:[&>button:hover]:!text-white [&>button>svg]:!fill-current"
                />
                <MiniMap
                  nodeColor={(node) => nodeStyles[(node.data as any)?.nodeType]?.accent || '#6b7280'}
                  className="!rounded-xl !border !shadow-lg bg-white dark:bg-[#111] !border-gray-200 dark:!border-white/[0.06]"
                  maskColor="var(--rf-minimap-mask, rgba(0,0,0,0.08))"
                />
                <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="var(--rf-dot, rgba(0,0,0,0.06))" />

                <Panel position="bottom-center">
                  <div className="bg-white dark:bg-[#161616] rounded-xl px-4 py-2 border border-gray-200 dark:border-white/[0.06] shadow-lg shadow-black/5 dark:shadow-black/40">
                    <span className="text-[9px] text-gray-400 dark:text-gray-500">Arrastra componentes • Clic en nodo para configurar • Conecta nodos arrastrando • Hover en línea para eliminar</span>
                  </div>
                </Panel>
              </ReactFlow>
            </div>

            {/* ── Right sidebar: Node config panel (Klaviyo-style) ── */}
            <NodeEditorSidebar
              show={showNodeEditor}
              node={editingNode}
              onClose={() => {
                setShowNodeEditor(false);
                setEditingNode(null);
              }}
              onSave={handleUpdateNode}
              onDelete={() => {
                if (editingNode) {
                  onNodeDelete(editingNode.id);
                  setShowNodeEditor(false);
                  setEditingNode(null);
                }
              }}
              availableFlows={chatbot?.flows || []}
              currentFlowId={currentFlow?.id}
            />
          </>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[#0a0a0a]">
            <div className="max-w-4xl mx-auto">
              <ChatbotSettings 
                chatbot={chatbot} 
                onUpdate={(updated) => setChatbot(updated)}
              />
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[#0a0a0a]">
            <ChatbotAnalyticsPanel chatbotId={chatbot.id} chatbotName={chatbot.name} />
          </div>
        )}
      </div>

      {/* Modal: Selector de flujos */}
      <Modal show={showFlowSelector} onClose={() => setShowFlowSelector(false)} size="md">
        <Modal.Header>Seleccionar Flujo</Modal.Header>
        <Modal.Body>
          <div className="space-y-2">
            {chatbot.flows?.map((flow) => (
              <button
                key={flow.id}
                onClick={() => {
                  setCurrentFlow(flow);
                  loadFlowNodes(flow);
                  setShowFlowSelector(false);
                  navigate(`/apps/whatsapp/chatbots/flujos?id=${chatbot.id}&flow=${flow.id}`);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  currentFlow?.id === flow.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{flow.name}</span>
                  {flow.is_default && <Badge color="info" size="sm">Por defecto</Badge>}
                </div>
                {flow.description && (
                  <p className="text-sm text-gray-500 mt-1">{flow.description}</p>
                )}
              </button>
            ))}
          </div>
        </Modal.Body>
      </Modal>

      {/* Modal: Nuevo flujo */}
      <Modal show={showNewFlowModal} onClose={() => setShowNewFlowModal(false)} size="md">
        <Modal.Header>Crear Nuevo Flujo</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del flujo
              </label>
              <TextInput
                placeholder="Ej: Flujo de ventas"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowNewFlowModal(false)}>Cancelar</Button>
          <Button color="blue" onClick={handleCreateFlow} disabled={!newFlowName.trim()}>
            Crear Flujo
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ==================== SIDEBAR EDITOR DE NODO (Klaviyo-style) ====================

interface NodeEditorModalProps {
  show: boolean;
  node: Node | null;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete: () => void;
  availableFlows?: ChatbotFlow[];
  currentFlowId?: number;
}

const NodeEditorSidebar: React.FC<NodeEditorModalProps> = ({ show, node, onClose, onSave, onDelete, availableFlows = [], currentFlowId }) => {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<NodeConfig>({});
  const [buttons, setButtons] = useState<{id: string; text: string}[]>([]);
  
  // Cargar empleados/usuarios del broker para el nodo transfer
  const { empleados, loading: loadingEmpleados } = useEmpleadosBroker();
  
  // Filtrar flujos disponibles (excluir el flujo actual para evitar loops)
  const otherFlows = availableFlows.filter(f => f.id !== currentFlowId);

  useEffect(() => {
    if (node) {
      const nodeName = (node.data as any).nodeName || '';
      setLabel(nodeName);
      const nodeConfig = (node.data as any).config || {};
      setConfig(nodeConfig);
      setButtons(nodeConfig.buttons || []);
    }
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    const finalConfig = { ...config };
    if (buttons.length > 0) {
      finalConfig.buttons = buttons;
    }
    onSave({ label, config: finalConfig });
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addButton = () => {
    setButtons([...buttons, { id: `btn_${Date.now()}`, text: '' }]);
  };

  const updateButton = (index: number, text: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], text };
    setButtons(newButtons);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const nodeType = (node.data as any).nodeType || 'message';
  const paletteItem = nodePalette.find(n => n.type === nodeType);

  return (
    <div
      className={`h-full bg-white dark:bg-[#111] border-l border-gray-200 dark:border-white/[0.06] flex flex-col shrink-0 transition-all duration-300 ${show ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div 
            className="p-1.5 rounded-lg shrink-0"
            style={{ backgroundColor: nodeStyles[nodeType]?.accentLight || '#f3f4f6' }}
          >
            <Icon icon={paletteItem?.icon || 'solar:widget-bold'} width={18} style={{ color: nodeStyles[nodeType]?.accent }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{paletteItem?.label || nodeType}</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{paletteItem?.description}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all shrink-0">
          <Icon icon="solar:close-circle-linear" width={18} />
        </button>
      </div>

      {/* Sidebar Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Nombre del nodo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nombre del paso
          </label>
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Saludo inicial, Preguntar nombre..."
          />
        </div>

        {/* ===== CONFIGURACIÓN NODO INICIO ===== */}
        {nodeType === 'start' && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <Icon icon="solar:play-circle-bold" className="text-green-600" width={20} />
              <span className="font-medium text-green-800 dark:text-green-300">Configuración de Inicio</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-400 mb-4">
              Este es el punto de entrada del flujo. Se activa cuando un trigger coincide con el mensaje del usuario.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Palabras clave que activan este flujo
                </label>
                <Textarea
                  value={config.keywords || ''}
                  onChange={(e) => updateConfig('keywords', e.target.value)}
                  placeholder="hola, buenos días, hey, hi (separadas por coma)"
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separa las palabras con comas. El flujo se activará cuando el usuario escriba alguna de estas palabras.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="first_message"
                  checked={config.trigger_first_message || false}
                  onChange={(e) => updateConfig('trigger_first_message', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="first_message" className="text-sm text-gray-700 dark:text-gray-300">
                  Activar con el primer mensaje de contactos nuevos
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO MENSAJE ===== */}
        {nodeType === 'message' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Icon icon="solar:chat-round-dots-bold" className="inline mr-1 text-blue-500" width={16} />
                Mensaje a enviar
              </label>
              <Textarea
                value={config.text || ''}
                onChange={(e) => updateConfig('text', e.target.value)}
                placeholder="Escribe el mensaje que se enviará al usuario..."
                rows={4}
                className="font-normal"
              />
              <div className="flex gap-2 mt-2">
                <Badge color="info" size="sm" className="cursor-pointer" onClick={() => updateConfig('text', (config.text || '') + ' {{nombre}}')}>
                  + Nombre
                </Badge>
                <Badge color="info" size="sm" className="cursor-pointer" onClick={() => updateConfig('text', (config.text || '') + ' {{telefono}}')}>
                  + Teléfono
                </Badge>
                <Badge color="info" size="sm" className="cursor-pointer" onClick={() => updateConfig('text', (config.text || '') + ' 👋')}>
                  + Emoji
                </Badge>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adjuntar archivo (opcional)
              </label>
              <div className="flex gap-2">
                <TextInput
                  value={config.media_url || ''}
                  onChange={(e) => updateConfig('media_url', e.target.value)}
                  placeholder="URL de imagen, video o documento"
                  className="flex-1"
                />
                <Select
                  value={config.media_type || ''}
                  onChange={(e) => updateConfig('media_type', e.target.value)}
                  className="w-32"
                >
                  <option value="">Tipo</option>
                  <option value="image">Imagen</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Documento</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO OPCIONES ===== */}
        {(nodeType === 'options' || nodeType === 'question') && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Icon icon="solar:list-check-bold" className="inline mr-1 text-purple-500" width={16} />
                Mensaje del menú
              </label>
              <Textarea
                value={config.text || ''}
                onChange={(e) => updateConfig('text', e.target.value)}
                placeholder="¿Qué te gustaría hacer?"
                rows={2}
              />
            </div>

            {/* Mensaje de error personalizado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Icon icon="solar:danger-triangle-bold" className="inline mr-1 text-red-500" width={16} />
                Mensaje de error (opción inválida)
              </label>
              <TextInput
                value={config.error_message || ''}
                onChange={(e) => updateConfig('error_message', e.target.value)}
                placeholder="Por favor, selecciona una opción válida (1, 2, 3...)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se muestra cuando el usuario escribe algo que no coincide con ninguna opción
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Opciones del menú
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Cada opción puede enlazar a un nodo diferente, transferir a un agente, o mostrar un mensaje de confirmación
              </p>
              <div className="space-y-3">
                {(config.options || []).map((opt: any, index: number) => (
                  <div key={opt.id} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex gap-2 items-center mb-2">
                      <Badge color="purple" size="sm">{index + 1}</Badge>
                      <TextInput
                        value={opt.text}
                        onChange={(e) => {
                          const newOptions = [...(config.options || [])];
                          newOptions[index] = { ...newOptions[index], text: e.target.value };
                          updateConfig('options', newOptions);
                        }}
                        placeholder={`Opción ${index + 1}`}
                        className="flex-1"
                      />
                      <Button color="failure" size="xs" onClick={() => {
                        const newOptions = (config.options || []).filter((_: any, i: number) => i !== index);
                        updateConfig('options', newOptions);
                      }}>
                        <Icon icon="solar:trash-bin-trash-bold" width={14} />
                      </Button>
                    </div>

                    {/* Mensaje de confirmación */}
                    <div className="mb-2">
                      <TextInput
                        sizing="sm"
                        value={opt.confirmation_message || ''}
                        onChange={(e) => {
                          const newOptions = [...(config.options || [])];
                          newOptions[index] = { ...newOptions[index], confirmation_message: e.target.value };
                          updateConfig('options', newOptions);
                        }}
                        placeholder="Mensaje después de seleccionar (opcional)"
                        className="text-xs"
                      />
                    </div>

                    <div className="flex gap-2 items-center text-sm">
                      <span className="text-gray-500 shrink-0">→ Ir a:</span>
                      <Select
                        sizing="sm"
                        value={opt.transfer_to ? '_transfer' : (opt.next_node_id || '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          const newOptions = [...(config.options || [])];
                          
                          if (value === '_transfer') {
                            newOptions[index] = { 
                              ...newOptions[index], 
                              next_node_id: undefined,
                              next_flow_id: undefined,
                              transfer_to: { department_id: null, user_id: null }
                            };
                          } else {
                            newOptions[index] = { 
                              ...newOptions[index], 
                              next_node_id: value || undefined,
                              next_flow_id: undefined,
                              transfer_to: undefined
                            };
                          }
                          updateConfig('options', newOptions);
                        }}
                        className="flex-1"
                      >
                        <option value="">Siguiente paso (por defecto)</option>
                        <option value="_end">Finalizar flujo</option>
                        <option value="_transfer">🔀 Transferir a agente</option>
                        {availableFlows.map((flow) => {
                          const flowNodes = (flow.nodes || []).filter(n => n.node_type !== 'start');
                          if (flowNodes.length === 0) return null;
                          const isCurrent = flow.id === currentFlowId;
                          return (
                            <optgroup key={flow.id} label={`${isCurrent ? '📌' : '📂'} ${flow.name}${isCurrent ? ' (actual)' : ''}`}>
                              {flowNodes.map((n) => (
                                <option key={n.id} value={String(n.id)}>
                                  {isCurrent ? '' : '↗ '}{n.name || n.node_type} ({n.node_type})
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </Select>
                    </div>
                    {/* Show cross-flow indicator */}
                    {opt.next_node_id && (() => {
                      const targetNode = availableFlows.flatMap(f => (f.nodes || []).map(n => ({ ...n, flowName: f.name, flowId: f.id }))).find(n => String(n.id) === String(opt.next_node_id));
                      if (targetNode && targetNode.flowId !== currentFlowId) {
                        return (
                          <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                            <Icon icon="solar:arrow-right-up-bold" width={12} />
                            <span>Cross-flow → <strong>{targetNode.flowName}</strong> › {targetNode.name || targetNode.node_type}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Configuración de transferencia */}
                    {opt.transfer_to && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon icon="solar:user-hand-up-bold" className="text-red-500" width={14} />
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">Transferir a:</span>
                        </div>
                        <Select
                          sizing="sm"
                          value={opt.transfer_to.user_id ? `user_${opt.transfer_to.user_id}` : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newOptions = [...(config.options || [])];
                            if (value.startsWith('user_')) {
                              const userId = parseInt(value.replace('user_', ''));
                              newOptions[index] = {
                                ...newOptions[index],
                                transfer_to: { user_id: userId, department_id: null }
                              };
                            } else {
                              newOptions[index] = {
                                ...newOptions[index],
                                transfer_to: { user_id: null, department_id: null }
                              };
                            }
                            updateConfig('options', newOptions);
                          }}
                        >
                          <option value="">Seleccionar empleado...</option>
                          {loadingEmpleados ? (
                            <option disabled>Cargando...</option>
                          ) : (
                            empleados.map((emp: any) => (
                              <option key={emp.id} value={`user_${emp.id}`}>
                                {emp.name} {emp.email ? `(${emp.email})` : ''}
                              </option>
                            ))
                          )}
                        </Select>
                        <TextInput
                          sizing="sm"
                          value={opt.transfer_message || ''}
                          onChange={(e) => {
                            const newOptions = [...(config.options || [])];
                            newOptions[index] = { ...newOptions[index], transfer_message: e.target.value };
                            updateConfig('options', newOptions);
                          }}
                          placeholder="Mensaje de transferencia (opcional)"
                          className="mt-2"
                        />
                      </div>
                    )}

                  </div>
                ))}
                {(config.options || []).length < 10 && (
                  <Button color="light" size="sm" onClick={() => {
                    const newOptions = [...(config.options || []), { id: `opt_${Date.now()}`, text: '', next_node_id: '' }];
                    updateConfig('options', newOptions);
                  }}>
                    <Icon icon="solar:add-circle-bold" className="mr-1" width={16} />
                    Agregar opción
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO ENTRADA ===== */}
        {nodeType === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Icon icon="solar:text-field-bold" className="inline mr-1 text-cyan-500" width={16} />
                Mensaje de solicitud
              </label>
              <Textarea
                value={config.text || ''}
                onChange={(e) => updateConfig('text', e.target.value)}
                placeholder="Por favor, escribe tu nombre..."
                rows={2}
              />
            </div>

            {/* Campo de contacto predefinido */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                <Icon icon="solar:user-id-bold" className="inline mr-1" width={16} />
                Guardar como dato de contacto
              </label>
              <Select
                value={config.contact_field || ''}
                onChange={(e) => {
                  const field = e.target.value;
                  updateConfig('contact_field', field || undefined);
                  // Auto-configurar validación según el campo
                  if (field === 'email') {
                    updateConfig('validation', 'email');
                  } else if (field === 'phone_secondary') {
                    updateConfig('validation', 'phone');
                  } else if (field && !config.validation) {
                    updateConfig('validation', 'not_empty');
                  }
                }}
              >
                <option value="">No guardar en contacto (usar variable)</option>
                <option value="first_name">📝 Nombre</option>
                <option value="last_name">📝 Apellido</option>
                <option value="document_id">🪪 Cédula / DNI</option>
                <option value="email">📧 Correo electrónico</option>
                <option value="phone_secondary">📱 Teléfono secundario</option>
                <option value="company">🏢 Empresa</option>
                <option value="city">📍 Ciudad</option>
                <option value="notes">📋 Notas</option>
              </Select>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                El dato se guardará automáticamente en el perfil del contacto y será visible en el Inbox
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Guardar en variable
                </label>
                <TextInput
                  value={config.variable_name || ''}
                  onChange={(e) => updateConfig('variable_name', e.target.value)}
                  placeholder="nombre_cliente"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usa esta variable en otros mensajes: {'{{'}{config.variable_name || 'variable'}{'}}'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Validación
                </label>
                <Select
                  value={config.validation || ''}
                  onChange={(e) => updateConfig('validation', e.target.value)}
                >
                  <option value="">Sin validación</option>
                  <option value="not_empty">No vacío</option>
                  <option value="text">Texto libre</option>
                  <option value="email">Email válido</option>
                  <option value="phone">Teléfono</option>
                  <option value="number">Solo números</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje de error (si no pasa validación)
              </label>
              <TextInput
                value={config.error_message || ''}
                onChange={(e) => updateConfig('error_message', e.target.value)}
                placeholder="Por favor, ingresa un valor válido"
              />
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO CONDICIÓN ===== */}
        {nodeType === 'condition' && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="solar:branching-paths-up-bold" className="text-orange-600" width={20} />
                <span className="font-medium text-orange-800 dark:text-orange-300">Bifurcación condicional</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Variable a evaluar
                  </label>
                  <TextInput
                    value={config.variable || ''}
                    onChange={(e) => updateConfig('variable', e.target.value)}
                    placeholder="Ej: respuesta_usuario, nombre, etc."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Operador
                    </label>
                    <Select
                      value={config.condition_type || 'equals'}
                      onChange={(e) => updateConfig('condition_type', e.target.value)}
                    >
                      <option value="equals">Es igual a</option>
                      <option value="not_equals">No es igual a</option>
                      <option value="contains">Contiene</option>
                      <option value="starts_with">Empieza con</option>
                      <option value="greater_than">Mayor que</option>
                      <option value="less_than">Menor que</option>
                      <option value="is_empty">Está vacío</option>
                      <option value="is_not_empty">No está vacío</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valor
                    </label>
                    <TextInput
                      value={config.condition_value || ''}
                      onChange={(e) => updateConfig('condition_value', e.target.value)}
                      placeholder="Valor a comparar"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Rutas de bifurcación */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon="solar:check-circle-bold" className="text-green-600" width={18} />
                  <span className="font-medium text-green-800 dark:text-green-300">Si es VERDADERO</span>
                </div>
                <Select
                  value={config.true_node_id || ''}
                  onChange={(e) => updateConfig('true_node_id', e.target.value)}
                >
                  <option value="">Siguiente paso</option>
                  <option value="_end">Finalizar flujo</option>
                </Select>
              </div>
              
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon="solar:close-circle-bold" className="text-red-600" width={18} />
                  <span className="font-medium text-red-800 dark:text-red-300">Si es FALSO</span>
                </div>
                <Select
                  value={config.false_node_id || ''}
                  onChange={(e) => updateConfig('false_node_id', e.target.value)}
                >
                  <option value="">Siguiente paso</option>
                  <option value="_end">Finalizar flujo</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO ACCIÓN ===== */}
        {nodeType === 'action' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de acción
              </label>
              <Select
                value={config.action_type || ''}
                onChange={(e) => updateConfig('action_type', e.target.value)}
              >
                <option value="">Selecciona una acción</option>
                <option value="set_variable">Guardar variable</option>
                <option value="http_request">Llamada HTTP</option>
                <option value="add_tag">Agregar etiqueta</option>
                <option value="remove_tag">Quitar etiqueta</option>
                <option value="notify_agent">Notificar agente</option>
              </Select>
            </div>
            {config.action_type === 'set_variable' && (
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  value={config.variable_name || ''}
                  onChange={(e) => updateConfig('variable_name', e.target.value)}
                  placeholder="Nombre de variable"
                />
                <TextInput
                  value={config.variable_value || ''}
                  onChange={(e) => updateConfig('variable_value', e.target.value)}
                  placeholder="Valor"
                />
              </div>
            )}
            {config.action_type === 'http_request' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select
                    value={config.http_method || 'GET'}
                    onChange={(e) => updateConfig('http_method', e.target.value)}
                    className="w-24"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                  </Select>
                  <TextInput
                    value={config.http_url || ''}
                    onChange={(e) => updateConfig('http_url', e.target.value)}
                    placeholder="https://api.ejemplo.com/webhook"
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO IA ===== */}
        {nodeType === 'ai_response' && (
          <div className="space-y-4">
            <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="solar:magic-stick-3-bold" className="text-pink-600" width={20} />
                <span className="font-medium text-pink-800 dark:text-pink-300">Respuesta con IA</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instrucciones para la IA (System Prompt)
                </label>
                <Textarea
                  value={config.system_prompt ?? config.ai_prompt ?? ''}
                  onChange={(e) => {
                    // Escribir en system_prompt (clave estándar) y limpiar ai_prompt legacy
                    const next = { ...config, system_prompt: e.target.value };
                    if ('ai_prompt' in next) delete next.ai_prompt;
                    setConfig(next);
                  }}
                  placeholder="Eres un asistente experto en... Tu objetivo es calcular/responder... Usa las variables {nombre_variable} para personalizar."
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usa <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{variable}'}</code> para insertar datos del flujo. Si está vacío, se usará el prompt general del chatbot.
                </p>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contexto adicional
                </label>
                <Textarea
                  value={config.ai_context ?? config.custom_instructions ?? ''}
                  onChange={(e) => updateConfig('ai_context', e.target.value)}
                  placeholder="Información sobre tu negocio, productos, servicios..."
                  rows={3}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre de la empresa
                </label>
                <TextInput
                  value={config.company_name || ''}
                  onChange={(e) => updateConfig('company_name', e.target.value)}
                  placeholder="Ej: Seguros Celeste Oriente"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se inyecta en el contexto de la IA como <code>{'{company_name}'}</code>.
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Modelo
                  </label>
                  <Select
                    value={config.model || ''}
                    onChange={(e) => updateConfig('model', e.target.value || undefined)}
                  >
                    <option value="">Usar el del chatbot</option>
                    <option value="deepseek-chat">DeepSeek Chat</option>
                    <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                    <option value="gpt-4o-mini">GPT-4o mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                    <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku</option>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(config.conversational ?? config.loop)}
                      onChange={(e) => updateConfig('conversational', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Modo conversacional (loop)
                  </label>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Máx. tokens
                  </label>
                  <TextInput
                    type="number"
                    value={config.max_tokens || 300}
                    onChange={(e) => updateConfig('max_tokens', parseInt(e.target.value) || 300)}
                    min={50}
                    max={2000}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Temperatura
                  </label>
                  <TextInput
                    type="number"
                    value={config.temperature ?? 0.7}
                    onChange={(e) => updateConfig('temperature', parseFloat(e.target.value) || 0.7)}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>
              </div>
            </div>

            {/* ===== REGLAS DE TRANSFERENCIA A ASESOR ===== */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:transfer-horizontal-bold" className="text-amber-600" width={20} />
                  <span className="font-medium text-amber-800 dark:text-amber-300">Reglas de transferencia</span>
                </div>
                <Button
                  size="xs"
                  color="warning"
                  onClick={() => {
                    const rules = Array.isArray(config.transfer_rules) ? [...config.transfer_rules] : [];
                    rules.push({
                      id: `rule_${Date.now().toString(36)}`,
                      name: '',
                      description: '',
                      user_id: undefined,
                      user_name: '',
                      message: '',
                    });
                    updateConfig('transfer_rules', rules);
                  }}
                >
                  <Icon icon="solar:add-circle-bold" className="mr-1" width={14} />
                  Añadir regla
                </Button>
              </div>

              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                Define criterios para que la IA transfiera automáticamente la conversación a un asesor específico.
                La IA incluirá <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">[TRANSFER:id]</code> al final de su respuesta cuando se cumpla la regla.
              </p>

              {/* Mensaje por defecto */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mensaje por defecto al transferir (si no hay regla específica)
                </label>
                <TextInput
                  value={config.transfer_default_message || ''}
                  onChange={(e) => updateConfig('transfer_default_message', e.target.value)}
                  placeholder="Un momento, te conecto con un asesor para ayudarte mejor 🙂"
                />
              </div>

              {/* Lista de reglas */}
              {(!config.transfer_rules || config.transfer_rules.length === 0) ? (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Icon icon="solar:inbox-line-duotone" className="mx-auto mb-1" width={28} />
                  <p>No hay reglas configuradas. La IA usará <code>[TRANSFER]</code> genérico.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {config.transfer_rules.map((rule: any, idx: number) => (
                    <div key={rule.id || idx} className="p-3 bg-white dark:bg-gray-800 rounded border border-amber-200 dark:border-amber-700">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-mono bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                          [TRANSFER:{rule.id || `regla_${idx}`}]
                        </span>
                        <Button
                          size="xs"
                          color="failure"
                          onClick={() => {
                            const rules = [...config.transfer_rules];
                            rules.splice(idx, 1);
                            updateConfig('transfer_rules', rules);
                          }}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" width={12} />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Nombre de la regla
                          </label>
                          <TextInput
                            sizing="sm"
                            value={rule.name || ''}
                            onChange={(e) => {
                              const rules = [...config.transfer_rules];
                              rules[idx] = { ...rules[idx], name: e.target.value };
                              updateConfig('transfer_rules', rules);
                            }}
                            placeholder="Ej: Cotización, Queja, Compra..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            ¿Cuándo aplicar? (contexto para la IA)
                          </label>
                          <Textarea
                            rows={2}
                            value={rule.description || ''}
                            onChange={(e) => {
                              const rules = [...config.transfer_rules];
                              rules[idx] = { ...rules[idx], description: e.target.value };
                              updateConfig('transfer_rules', rules);
                            }}
                            placeholder="Ej: Cuando el cliente pide cotizar, comprar o habla de precios específicos"
                            className="text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            <Icon icon="solar:user-bold" className="inline mr-1 text-amber-600" width={12} />
                            Asignar a
                          </label>
                          {loadingEmpleados ? (
                            <Spinner size="sm" />
                          ) : (
                            <Select
                              sizing="sm"
                              value={rule.user_id?.toString() || ''}
                              onChange={(e) => {
                                const userId = e.target.value ? Number(e.target.value) : undefined;
                                const selectedUser = empleados.find((emp: any) => emp.id === userId);
                                const rules = [...config.transfer_rules];
                                rules[idx] = {
                                  ...rules[idx],
                                  user_id: userId,
                                  user_name: selectedUser ? `${selectedUser.nombres} ${selectedUser.apellidos || ''}`.trim() : '',
                                };
                                updateConfig('transfer_rules', rules);
                              }}
                            >
                              <option value="">-- Primer disponible --</option>
                              {empleados.filter((emp: any) => emp.acceso_activo !== false && emp.estado === 'activo').map((emp: any) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.nombres} {emp.apellidos || ''}{emp.cargo ? ` - ${emp.cargo}` : ''}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Mensaje personalizado (opcional)
                          </label>
                          <TextInput
                            sizing="sm"
                            value={rule.message || ''}
                            onChange={(e) => {
                              const rules = [...config.transfer_rules];
                              rules[idx] = { ...rules[idx], message: e.target.value };
                              updateConfig('transfer_rules', rules);
                            }}
                            placeholder="Ej: Te conecto con {user_name} de ventas para que te cotice"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO TRANSFERIR ===== */}
        {nodeType === 'transfer' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="solar:user-hand-up-bold" className="text-red-600" width={20} />
                <span className="font-medium text-red-800 dark:text-red-300">Transferir a agente humano</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                La conversación será transferida a un usuario de tu equipo para atención personalizada.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mensaje antes de transferir
              </label>
              <Textarea
                value={config.transfer_message || ''}
                onChange={(e) => updateConfig('transfer_message', e.target.value)}
                placeholder="Te voy a comunicar con un asesor humano. Por favor espera un momento..."
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Icon icon="solar:user-bold" className="inline mr-1 text-red-500" width={16} />
                Transferir a usuario/vendedor
              </label>
              {loadingEmpleados ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Spinner size="sm" />
                  <span className="text-sm">Cargando usuarios...</span>
                </div>
              ) : (
                <Select
                  value={config.transfer_to_user_id?.toString() || ''}
                  onChange={(e) => {
                    const userId = e.target.value ? Number(e.target.value) : undefined;
                    const selectedUser = empleados.find(emp => emp.id === userId);
                    updateConfig('transfer_to_user_id', userId);
                    updateConfig('transfer_to_user_name', selectedUser ? `${selectedUser.nombres} ${selectedUser.apellidos || ''}`.trim() : '');
                    // También actualizar transfer_to para compatibilidad
                    updateConfig('transfer_to', selectedUser ? `${selectedUser.nombres} ${selectedUser.apellidos || ''}`.trim() : '');
                  }}
                >
                  <option value="">-- Seleccionar usuario --</option>
                  {empleados.filter(emp => emp.acceso_activo !== false && emp.estado === 'activo').map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombres} {empleado.apellidos || ''} 
                      {empleado.cargo ? ` - ${empleado.cargo}` : ''}
                      {empleado.email ? ` (${empleado.email})` : ''}
                    </option>
                  ))}
                </Select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Selecciona el usuario de tu equipo que recibirá la conversación
              </p>
            </div>
            
            {/* Opción alternativa: texto libre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                O escribe un nombre/departamento manualmente
              </label>
              <TextInput
                value={config.transfer_to || ''}
                onChange={(e) => {
                  updateConfig('transfer_to', e.target.value);
                  // Si escribe manualmente, limpiar el user_id
                  if (e.target.value && !empleados.find(emp => `${emp.nombres} ${emp.apellidos || ''}`.trim() === e.target.value)) {
                    updateConfig('transfer_to_user_id', undefined);
                    updateConfig('transfer_to_user_name', undefined);
                  }
                }}
                placeholder="Ej: Soporte Técnico, Ventas, etc."
              />
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO ESPERA ===== */}
        {nodeType === 'delay' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tiempo de espera
              </label>
              <div className="flex gap-2 items-center">
                <TextInput
                  type="number"
                  value={config.delay_seconds || 3}
                  onChange={(e) => updateConfig('delay_seconds', Number(e.target.value))}
                  min={1}
                  max={300}
                  className="w-24"
                />
                <span className="text-gray-600">segundos</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                El bot esperará este tiempo antes de continuar al siguiente paso
              </p>
            </div>
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO CONSULTAR PÓLIZA ===== */}
        {nodeType === 'policy_lookup' && (
          <div className="space-y-4">
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="solar:shield-check-bold" className="text-teal-600" width={20} />
                <span className="font-medium text-teal-800 dark:text-teal-300">Consulta de Pólizas</span>
              </div>
              <p className="text-sm text-teal-700 dark:text-teal-400">
                El bot pedirá el documento de identidad y un campo de verificación para mostrar las pólizas del cliente y enviar la carátula.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Icon icon="solar:lock-bold" className="inline mr-1 text-teal-500" width={16} />
                Campo de verificación
              </label>
              <Select
                value={config.validation_field || 'email'}
                onChange={(e) => updateConfig('validation_field', e.target.value)}
              >
                <option value="email">Correo electrónico</option>
                <option value="phone">Número de teléfono</option>
                <option value="birth_date">Fecha de nacimiento</option>
                <option value="policy_number">Número de póliza</option>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Después del documento, se pedirá este dato para verificar la identidad del cliente.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="send_documents"
                checked={config.send_documents !== false}
                onChange={(e) => updateConfig('send_documents', e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="send_documents" className="text-sm text-gray-700 dark:text-gray-300">
                Permitir enviar documentos/carátula de la póliza
              </label>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Mensajes personalizados (opcional)</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Pedir documento
                  </label>
                  <Textarea
                    value={config.ask_document_message || ''}
                    onChange={(e) => updateConfig('ask_document_message', e.target.value)}
                    placeholder="📋 Para consultar tus pólizas, por favor escribe tu número de documento (cédula):"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Pedir verificación
                  </label>
                  <Textarea
                    value={config.ask_validation_message || ''}
                    onChange={(e) => updateConfig('ask_validation_message', e.target.value)}
                    placeholder="🔐 Para verificar tu identidad, por favor escribe tu {field_label}:"
                    rows={2}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Usa <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{field_label}'}</code> para el nombre del campo.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Sin resultados
                  </label>
                  <TextInput
                    value={config.no_results_message || ''}
                    onChange={(e) => updateConfig('no_results_message', e.target.value)}
                    placeholder="❌ No encontramos pólizas activas asociadas a ese documento."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Error de verificación
                  </label>
                  <TextInput
                    value={config.validation_error_message || ''}
                    onChange={(e) => updateConfig('validation_error_message', e.target.value)}
                    placeholder="❌ Los datos de verificación no coinciden."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Verificación exitosa
                  </label>
                  <TextInput
                    value={config.success_message || ''}
                    onChange={(e) => updateConfig('success_message', e.target.value)}
                    placeholder="✅ Identidad verificada. Estas son tus pólizas activas:"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO AGREGAR/QUITAR ETIQUETA ===== */}
        {(nodeType === 'add_tag' || nodeType === 'remove_tag') && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${nodeType === 'add_tag' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon icon={nodeType === 'add_tag' ? 'solar:tag-horizontal-bold' : 'solar:tag-horizontal-bold-duotone'} className={nodeType === 'add_tag' ? 'text-emerald-600' : 'text-rose-600'} width={20} />
                <span className={`font-medium ${nodeType === 'add_tag' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                  {nodeType === 'add_tag' ? 'Agregar etiqueta' : 'Quitar etiqueta'}
                </span>
              </div>
              <p className={`text-sm ${nodeType === 'add_tag' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {nodeType === 'add_tag' ? 'Agrega una etiqueta a la conversación para clasificarla.' : 'Remueve una etiqueta de la conversación.'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre de la etiqueta
              </label>
              <TextInput
                value={config.tag_name || ''}
                onChange={(e) => updateConfig('tag_name', e.target.value)}
                placeholder="Ej: interesado, cotización, cliente_nuevo"
              />
            </div>
            {nodeType === 'add_tag' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {['blue','green','red','yellow','purple','pink','orange','teal','gray'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateConfig('tag_color', c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${config.tag_color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: { blue:'#3b82f6', green:'#22c55e', red:'#ef4444', yellow:'#eab308', purple:'#a855f7', pink:'#ec4899', orange:'#f97316', teal:'#14b8a6', gray:'#6b7280' }[c] }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== CONFIGURACIÓN NODO FIN ===== */}
        {nodeType === 'end' && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Icon icon="solar:stop-circle-bold" className="text-gray-600" width={20} />
              <span className="font-medium text-gray-800 dark:text-gray-300">Fin del flujo</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje de despedida (opcional)
              </label>
              <Textarea
                value={config.goodbye_message || ''}
                onChange={(e) => updateConfig('goodbye_message', e.target.value)}
                placeholder="¡Gracias por contactarnos! Que tengas un excelente día 👋"
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer — sticky action buttons */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#111]">
        <div className="flex items-center justify-between gap-2">
          {nodeType !== 'start' ? (
            <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95">
              <Icon icon="solar:trash-bin-trash-bold" width={14} />
              Eliminar
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-all active:scale-95">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20">
              <Icon icon="solar:diskette-bold" width={13} className="mr-1 inline" />
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== WRAPPER CON PROVIDER ====================

const FlowEditorSimple: React.FC = () => (
  <ReactFlowProvider>
    <FlowEditorContent />
  </ReactFlowProvider>
);

export default FlowEditorSimple;

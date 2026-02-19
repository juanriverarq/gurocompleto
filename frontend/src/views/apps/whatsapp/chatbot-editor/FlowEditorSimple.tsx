import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  type NodeProps,
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
];

const nodeStyles: Record<string, { bg: string; border: string; text: string }> = {
  start: { bg: '#1a2e1a', border: '#22c55e', text: '#86efac' },
  message: { bg: '#1a2233', border: '#3b82f6', text: '#93c5fd' },
  options: { bg: '#231a33', border: '#a855f7', text: '#d8b4fe' },
  input: { bg: '#1a2b2e', border: '#06b6d4', text: '#67e8f9' },
  condition: { bg: '#2e2215', border: '#f97316', text: '#fdba74' },
  action: { bg: '#2e2b15', border: '#eab308', text: '#fde047' },
  ai_response: { bg: '#2e1a27', border: '#ec4899', text: '#f9a8d4' },
  transfer: { bg: '#2e1a1a', border: '#ef4444', text: '#fca5a5' },
  delay: { bg: '#1e1e1e', border: '#6b7280', text: '#d1d5db' },
  end: { bg: '#1c1e22', border: '#64748b', text: '#cbd5e1' },
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
};

// ==================== CUSTOM NODE WITH HOVER ACTIONS ====================

const GuroFlowNode: React.FC<NodeProps> = ({ data, id, selected }) => {
  const [hovered, setHovered] = useState(false);
  const nodeType = (data as any).nodeType || 'message';
  const nodeName = (data as any).nodeName || 'Nodo';
  const config = (data as any).config || {};
  const style = nodeStyles[nodeType] || nodeStyles.message;
  const icon = nodeIcons[nodeType] || 'solar:widget-bold';

  const onEdit = (data as any).onEdit;
  const onDelete = (data as any).onDelete;
  const onDuplicate = (data as any).onDuplicate;

  const hasOptionHandles = (nodeType === 'options' || nodeType === 'question') && config.options?.length > 0;
  const hasConditionHandles = nodeType === 'condition';

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: style.bg,
        border: `1px solid ${selected ? style.border : style.border + '40'}`,
        borderRadius: '12px',
        minWidth: hasOptionHandles ? '220px' : '180px',
        boxShadow: selected
          ? `0 0 0 2px ${style.border}60, 0 4px 20px rgba(0,0,0,0.4)`
          : '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Target handle (left) — always present */}
      <Handle type="target" position={Position.Left} style={{ background: style.border, width: 8, height: 8, border: '2px solid #0a0a0a' }} />

      {/* Default source handle (right) — for non-options, non-condition nodes */}
      {!hasOptionHandles && !hasConditionHandles && (
        <Handle type="source" position={Position.Right} style={{ background: style.border, width: 8, height: 8, border: '2px solid #0a0a0a' }} />
      )}

      {/* Node header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
        <Icon icon={icon} width={20} style={{ color: style.border, flexShrink: 0 }} />
        <span style={{ color: style.text, fontWeight: 500, fontSize: '13px' }}>{nodeName}</span>
      </div>

      {/* Per-option source handles for options nodes */}
      {hasOptionHandles && (
        <div style={{ borderTop: `1px solid ${style.border}30`, padding: '4px 0' }}>
          {config.options.map((opt: any, idx: number) => (
            <div key={opt.id || idx} className="relative flex items-center" style={{ padding: '3px 10px 3px 12px', minHeight: '26px' }}>
              <span style={{ color: style.text, fontSize: '10px', opacity: 0.8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opt.text || `Opción ${idx + 1}`}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`opt-${idx}`}
                style={{
                  background: '#a855f7',
                  width: 7,
                  height: 7,
                  border: '2px solid #0a0a0a',
                  right: -4,
                  top: '50%',
                  position: 'absolute',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Per-branch source handles for condition nodes */}
      {hasConditionHandles && (
        <div style={{ borderTop: `1px solid ${style.border}30`, padding: '4px 0' }}>
          <div className="relative flex items-center" style={{ padding: '3px 10px 3px 12px', minHeight: '26px' }}>
            <span style={{ color: '#86efac', fontSize: '10px', fontWeight: 600 }}>✓ Sí</span>
            <Handle
              type="source"
              position={Position.Right}
              id="condition-true"
              style={{ background: '#22c55e', width: 7, height: 7, border: '2px solid #0a0a0a', right: -4, top: '50%', position: 'absolute' }}
            />
          </div>
          <div className="relative flex items-center" style={{ padding: '3px 10px 3px 12px', minHeight: '26px' }}>
            <span style={{ color: '#fca5a5', fontSize: '10px', fontWeight: 600 }}>✗ No</span>
            <Handle
              type="source"
              position={Position.Right}
              id="condition-false"
              style={{ background: '#ef4444', width: 7, height: 7, border: '2px solid #0a0a0a', right: -4, top: '50%', position: 'absolute' }}
            />
          </div>
        </div>
      )}

      {/* Invisible hover bridge */}
      {hovered && (
        <div className="absolute -top-10 left-0 right-0 h-10" style={{ zIndex: 9 }} />
      )}

      {/* Hover action bar */}
      {hovered && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-1 rounded-xl border border-white/[0.08] shadow-xl shadow-black/50"
          style={{ background: '#1a1a1a', zIndex: 10 }}
        >
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              title="Editar"
            >
              <Icon icon="solar:pen-bold" width={13} />
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90"
              title="Duplicar"
            >
              <Icon icon="solar:copy-bold" width={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
              title="Eliminar"
            >
              <Icon icon="solar:trash-bin-trash-bold" width={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const customNodeTypes = { guroNode: GuroFlowNode };

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
        style: { stroke: '#94a3b8', strokeWidth: 2 },
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
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
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
    let edgeStyle: any = { animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } };

    if (sourceHandle.startsWith('opt-')) {
      // Find the option label from the source node
      const sourceNode = nodes.find(n => n.id === params.source);
      const optIdx = parseInt(sourceHandle.replace('opt-', ''));
      const optText = (sourceNode?.data as any)?.config?.options?.[optIdx]?.text || `Opción ${optIdx + 1}`;
      edgeStyle = {
        animated: true,
        label: optText,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
        labelStyle: { fontSize: 10, fill: '#8b5cf6', fontWeight: 500 },
        labelBgStyle: { fill: '#f5f3ff', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    } else if (sourceHandle === 'condition-true') {
      edgeStyle = {
        animated: true,
        label: 'Sí',
        style: { stroke: '#22c55e', strokeWidth: 2 },
        labelStyle: { fontSize: 10, fill: '#22c55e', fontWeight: 600 },
        labelBgStyle: { fill: '#f0fdf4', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    } else if (sourceHandle === 'condition-false') {
      edgeStyle = {
        animated: true,
        label: 'No',
        style: { stroke: '#ef4444', strokeWidth: 2 },
        labelStyle: { fontSize: 10, fill: '#ef4444', fontWeight: 600 },
        labelBgStyle: { fill: '#fef2f2', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    }

    setEdges((eds) => addEdge({ ...params, ...edgeStyle }, eds));
  }, [setEdges, nodes]);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (confirm('¿Eliminar esta conexión?')) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  }, [setEdges]);

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
      default:
        return {};
    }
  };

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNode(node);
    setShowNodeEditor(true);
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

  // Inject callbacks into nodes so the custom GuroFlowNode can use them
  const nodesWithCallbacks = useMemo(() =>
    nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: onEditNode,
        onDelete: onNodeDelete,
        onDuplicate: onDuplicateNode,
      },
    })),
    [nodes, onEditNode, onNodeDelete, onDuplicateNode]
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
                  <Icon icon={item.icon} width={15} style={{ color: nodeStyles[item.type]?.border }} />
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
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${nodeStyles[item.type]?.border}15` }}>
                      <Icon icon={item.icon} width={14} style={{ color: nodeStyles[item.type]?.border }} />
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

        {/* ── Main content area ── */}
        {activeTab === 'flows' && (
          <div className="flex-1 bg-gray-100 dark:bg-[#0a0a0a]">
            <ReactFlow
              nodes={nodesWithCallbacks}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={customNodeTypes}
              fitView
              snapToGrid
              snapGrid={[20, 20]}
              defaultEdgeOptions={{
                animated: true,
                style: { stroke: '#22c55e80', strokeWidth: 2 },
              }}
              style={{ background: 'var(--rf-bg, #0a0a0a)' }}
              className="[--rf-bg:#f3f4f6] dark:[--rf-bg:#0a0a0a]"
            >
              <Controls
                position="bottom-right"
                style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}
                className="!shadow-xl !shadow-black/40 [&>button]:!bg-[#161616] [&>button]:!border-white/[0.04] [&>button]:!text-gray-400 [&>button:hover]:!bg-white/5 [&>button:hover]:!text-white [&>button>svg]:!fill-current"
              />
              <MiniMap
                nodeColor={(node) => nodeStyles[(node.data as any)?.nodeType]?.border || '#6b7280'}
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}
                maskColor="rgba(0,0,0,0.7)"
              />
              <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="rgba(255,255,255,0.04)" />

              <Panel position="bottom-center">
                <div className="bg-[#161616] rounded-xl px-4 py-2 border border-white/[0.06] shadow-xl shadow-black/40">
                  <span className="text-[9px] text-gray-500">Arrastra componentes • Doble clic para editar • Conecta nodos arrastrando</span>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a]">
            <div className="max-w-4xl mx-auto">
              <ChatbotSettings 
                chatbot={chatbot} 
                onUpdate={(updated) => setChatbot(updated)}
              />
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a]">
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

      {/* Modal: Editor de nodo */}
      <NodeEditorModal
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
    </div>
  );
};

// ==================== MODAL EDITOR DE NODO ====================

interface NodeEditorModalProps {
  show: boolean;
  node: Node | null;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete: () => void;
  availableFlows?: ChatbotFlow[];
  currentFlowId?: number;
}

const NodeEditorModal: React.FC<NodeEditorModalProps> = ({ show, node, onClose, onSave, onDelete, availableFlows = [], currentFlowId }) => {
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
    <Modal show={show} onClose={onClose} size="xl">
      <Modal.Header>
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: nodeStyles[nodeType]?.bg, borderColor: nodeStyles[nodeType]?.border }}
          >
            <Icon icon={paletteItem?.icon || 'solar:widget-bold'} width={24} style={{ color: nodeStyles[nodeType]?.border }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{paletteItem?.label || nodeType}</h3>
            <p className="text-sm text-gray-500">{paletteItem?.description}</p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body className="space-y-6">
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
                      <span className="text-gray-500">→ Ir a:</span>
                      <Select
                        sizing="sm"
                        value={opt.transfer_to ? '_transfer' : (opt.next_flow_id ? `flow_${opt.next_flow_id}` : (opt.next_node_id || ''))}
                        onChange={(e) => {
                          const value = e.target.value;
                          const newOptions = [...(config.options || [])];
                          
                          if (value === '_transfer') {
                            // Transferir a agente
                            newOptions[index] = { 
                              ...newOptions[index], 
                              next_node_id: undefined,
                              next_flow_id: undefined,
                              transfer_to: { department_id: null, user_id: null }
                            };
                          } else if (value.startsWith('flow_')) {
                            // Es un flujo
                            const flowId = parseInt(value.replace('flow_', ''));
                            newOptions[index] = { 
                              ...newOptions[index], 
                              next_node_id: undefined,
                              next_flow_id: flowId,
                              transfer_to: undefined
                            };
                          } else {
                            // Es un nodo o acción especial
                            newOptions[index] = { 
                              ...newOptions[index], 
                              next_node_id: value,
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
                        {otherFlows.length > 0 && (
                          <optgroup label="📂 Ir a otro flujo">
                            {otherFlows.map((flow) => (
                              <option key={flow.id} value={`flow_${flow.id}`}>
                                🔀 {flow.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                    </div>

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

                    {opt.next_flow_id && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                        <Icon icon="solar:arrow-right-up-bold" width={12} />
                        <span>Redirige al flujo: <strong>{otherFlows.find(f => f.id === opt.next_flow_id)?.name || `#${opt.next_flow_id}`}</strong></span>
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
                  Instrucciones para la IA
                </label>
                <Textarea
                  value={config.ai_prompt || ''}
                  onChange={(e) => updateConfig('ai_prompt', e.target.value)}
                  placeholder="Responde de manera amable y profesional. Si el usuario pregunta por precios, menciona que un asesor se comunicará pronto..."
                  rows={4}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contexto adicional
                </label>
                <Textarea
                  value={config.ai_context || ''}
                  onChange={(e) => updateConfig('ai_context', e.target.value)}
                  placeholder="Información sobre tu negocio, productos, servicios..."
                  rows={2}
                />
              </div>
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
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between w-full">
          {nodeType !== 'start' ? (
            <Button color="failure" onClick={onDelete}>
              <Icon icon="solar:trash-bin-trash-bold" className="mr-1" width={16} />
              Eliminar
            </Button>
          ) : (
            <div></div>
          )}
          <div className="flex gap-2">
            <Button color="gray" onClick={onClose}>Cancelar</Button>
            <Button color="blue" onClick={handleSave}>
              <Icon icon="solar:diskette-bold" className="mr-1" width={16} />
              Guardar
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

// ==================== WRAPPER CON PROVIDER ====================

const FlowEditorSimple: React.FC = () => (
  <ReactFlowProvider>
    <FlowEditorContent />
  </ReactFlowProvider>
);

export default FlowEditorSimple;

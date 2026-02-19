import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Modal, TextInput, Textarea, Select, Badge, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { nodeTypes } from './nodes';
import chatbotService, { 
  Chatbot, 
  ChatbotFlow, 
  NodeType, 
  NodeConfig,
} from 'src/services/chatbotService';
import { useToast } from 'src/hooks/use-toast';

// ==================== TIPOS ====================

interface NodePaletteItem {
  type: NodeType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const nodePalette: NodePaletteItem[] = [
  { type: 'start', label: 'Inicio', icon: 'solar:play-circle-bold', color: 'green', description: 'Punto de inicio' },
  { type: 'message', label: 'Mensaje', icon: 'solar:chat-round-dots-bold', color: 'blue', description: 'Enviar mensaje' },
  { type: 'question', label: 'Pregunta', icon: 'solar:question-circle-bold', color: 'purple', description: 'Pregunta con opciones' },
  { type: 'input', label: 'Entrada', icon: 'solar:text-field-bold', color: 'cyan', description: 'Capturar respuesta' },
  { type: 'condition', label: 'Condición', icon: 'solar:branching-paths-up-bold', color: 'orange', description: 'Bifurcación' },
  { type: 'action', label: 'Acción', icon: 'solar:bolt-bold', color: 'yellow', description: 'Ejecutar acción' },
  { type: 'ai_response', label: 'IA', icon: 'solar:magic-stick-3-bold', color: 'pink', description: 'Respuesta con IA' },
  { type: 'transfer', label: 'Transferir', icon: 'solar:user-hand-up-bold', color: 'red', description: 'Transferir a humano' },
  { type: 'delay', label: 'Espera', icon: 'solar:clock-circle-bold', color: 'gray', description: 'Pausar flujo' },
  { type: 'end', label: 'Fin', icon: 'solar:stop-circle-bold', color: 'slate', description: 'Finalizar flujo' },
];

// ==================== COMPONENTE PRINCIPAL ====================

const FlowEditorInner: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatbotId = searchParams.get('id');
  const flowId = searchParams.get('flow');

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Estados
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [currentFlow, setCurrentFlow] = useState<ChatbotFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Modales
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

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
        
        // Seleccionar flujo
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
      toast({ title: 'Error', description: 'No se pudo cargar el chatbot', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadFlowNodes = (flow: ChatbotFlow) => {
    if (!flow.nodes || flow.nodes.length === 0) {
      // Crear nodo de inicio por defecto
      setNodes([{
        id: 'start-1',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Inicio', config: {} },
      }]);
      setEdges([]);
      return;
    }

    // Convertir nodos de la API a nodos de React Flow
    const flowNodes: Node[] = flow.nodes.map(node => ({
      id: String(node.id),
      type: node.node_type,
      position: { x: node.position_x, y: node.position_y },
      data: { 
        label: node.name || getNodeLabel(node.node_type),
        config: node.config || {},
      },
    }));

    // Edges from next_node_id (linear connections)
    const linearEdges: Edge[] = flow.nodes
      .filter(node => node.next_node_id)
      .map(node => ({
        id: `e${node.id}-${node.next_node_id}`,
        source: String(node.id),
        target: String(node.next_node_id),
        animated: true,
        style: { stroke: '#6b7280' },
      }));

    // Edges from options[].next_node_id (branching connections)
    const optionEdges: Edge[] = flow.nodes.flatMap(node => {
      const options = node.config?.options || [];
      return options
        .filter((opt: any) => opt.next_node_id)
        .map((opt: any, idx: number) => ({
          id: `e${node.id}-opt${idx}-${opt.next_node_id}`,
          source: String(node.id),
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

  // Handlers de React Flow
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6b7280' } }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
          label: getNodeLabel(type),
          config: getDefaultConfig(type),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
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

  // Guardar flujo
  const handleSaveFlow = async () => {
    if (!currentFlow || !chatbot) return;

    try {
      setSaving(true);

      // Crear mapa de IDs temporales a índices
      const nodeIdToIndex = new Map<string, number>();
      nodes.forEach((n, i) => nodeIdToIndex.set(n.id, i));

      // Convertir nodos de React Flow a formato API
      const nodesToSave = nodes.map((node, index) => {
        const config = JSON.parse(JSON.stringify(node.data.config || {}));

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

        // Map condition edges
        const trueEdge = outgoingEdges.find(e => e.sourceHandle === 'condition-true');
        const falseEdge = outgoingEdges.find(e => e.sourceHandle === 'condition-false');
        if (trueEdge) config.true_node_index = nodeIdToIndex.get(trueEdge.target);
        if (falseEdge) config.false_node_index = nodeIdToIndex.get(falseEdge.target);

        return {
          temp_id: node.id,
          temp_index: index,
          node_type: node.type as NodeType,
          name: node.data.label,
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
          config,
          next_node_index: nextNodeIndex,
        };
      });

      // Guardar nodos en lote
      const result = await chatbotService.updateNodesBulk(currentFlow.id, nodesToSave);

      if (result.success) {
        toast({ title: '¡Guardado!', description: 'El flujo se ha guardado correctamente' });
        await loadChatbot();
      } else {
        toast({ title: 'Error', description: result.message || 'No se pudo guardar', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error guardando flujo:', error);
      toast({ title: 'Error', description: 'Error al guardar el flujo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Crear nuevo flujo
  const handleCreateFlow = async () => {
    if (!chatbot || !newFlowName.trim()) return;

    try {
      const result = await chatbotService.createFlow(chatbot.id, {
        name: newFlowName,
        description: '',
        is_default: false,
      });

      if (result.success && result.data) {
        toast({ title: '¡Flujo creado!', description: `Se ha creado el flujo "${newFlowName}"` });
        setShowNewFlowModal(false);
        setNewFlowName('');
        await loadChatbot();
        
        // Navegar al nuevo flujo
        navigate(`/apps/whatsapp/chatbots/flujos?id=${chatbot.id}&flow=${result.data.id}`);
      }
    } catch (error) {
      console.error('Error creando flujo:', error);
    }
  };

  // Actualizar nodo editado
  const handleUpdateNode = (updatedData: any) => {
    if (!editingNode) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === editingNode.id
          ? { ...node, data: { ...node.data, ...updatedData } }
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

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button color="light" size="sm" onClick={() => navigate('/apps/whatsapp/chatbots')}>
              <Icon icon="solar:arrow-left-bold" width={18} />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon="solar:bot-bold-duotone" className="text-blue-500" width={22} />
                {chatbot.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Flujo:</span>
                <button 
                  onClick={() => setShowFlowSelector(true)}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {currentFlow?.name || 'Seleccionar'}
                  <Icon icon="solar:alt-arrow-down-bold" width={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button color="light" size="sm" onClick={() => setShowNewFlowModal(true)}>
              <Icon icon="solar:add-circle-bold" className="mr-1" width={16} />
              Nuevo Flujo
            </Button>
            <Button color="blue" size="sm" onClick={handleSaveFlow} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-1" /> : <Icon icon="solar:diskette-bold" className="mr-1" width={16} />}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex">
        {/* Paleta de nodos */}
        <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Componentes
          </h3>
          <div className="space-y-2">
            {nodePalette.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', item.type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-grab hover:shadow-md transition-shadow"
              >
                <div className={`p-1.5 rounded-md bg-${item.color}-100 dark:bg-${item.color}-900/30`}>
                  <Icon icon={item.icon} className={`text-${item.color}-600`} width={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 truncate">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6b7280', strokeWidth: 2 },
            }}
          >
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                const colors: Record<string, string> = {
                  start: '#22c55e',
                  message: '#3b82f6',
                  question: '#a855f7',
                  input: '#06b6d4',
                  condition: '#f97316',
                  action: '#eab308',
                  ai_response: '#ec4899',
                  transfer: '#ef4444',
                  delay: '#6b7280',
                  end: '#64748b',
                };
                return colors[node.type || ''] || '#6b7280';
              }}
            />
            <Background gap={15} size={1} />
            
            <Panel position="bottom-center" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-500">
              Arrastra componentes • Doble clic para editar • Conecta nodos arrastrando
            </Panel>
          </ReactFlow>
        </div>
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
}

const NodeEditorModal: React.FC<NodeEditorModalProps> = ({ show, node, onClose, onSave, onDelete }) => {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<NodeConfig>({});

  useEffect(() => {
    if (node) {
      setLabel(node.data.label || '');
      setConfig(node.data.config || {});
    }
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    onSave({ label, config });
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon={nodePalette.find(n => n.type === node.type)?.icon || 'solar:widget-bold'} width={20} />
          Editar: {nodePalette.find(n => n.type === node.type)?.label || node.type}
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del nodo
            </label>
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nombre descriptivo"
            />
          </div>

          {/* Campos específicos por tipo de nodo */}
          {(node.type === 'message' || node.type === 'question') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje
              </label>
              <Textarea
                value={config.text || ''}
                onChange={(e) => updateConfig('text', e.target.value)}
                placeholder="Escribe el mensaje..."
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                Usa @variable para insertar variables dinámicas
              </p>
            </div>
          )}

          {node.type === 'input' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre de variable
                </label>
                <TextInput
                  value={config.variable_name || ''}
                  onChange={(e) => updateConfig('variable_name', e.target.value)}
                  placeholder="nombre_cliente"
                />
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
                  <option value="email">Email</option>
                  <option value="phone">Teléfono</option>
                  <option value="number">Número</option>
                  <option value="text">Texto (no vacío)</option>
                </Select>
              </div>
            </>
          )}

          {node.type === 'condition' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de condición
                </label>
                <Select
                  value={config.condition_type || 'equals'}
                  onChange={(e) => updateConfig('condition_type', e.target.value)}
                >
                  <option value="equals">Es igual a</option>
                  <option value="contains">Contiene</option>
                  <option value="greater_than">Mayor que</option>
                  <option value="less_than">Menor que</option>
                  <option value="regex">Expresión regular</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor a comparar
                </label>
                <TextInput
                  value={config.condition_value || ''}
                  onChange={(e) => updateConfig('condition_value', e.target.value)}
                  placeholder="Valor o @variable"
                />
              </div>
            </>
          )}

          {node.type === 'delay' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tiempo de espera (ms)
              </label>
              <TextInput
                type="number"
                value={config.delay_ms || 1000}
                onChange={(e) => updateConfig('delay_ms', Number(e.target.value))}
                min={100}
                max={30000}
              />
              <p className="text-xs text-gray-500 mt-1">
                1000ms = 1 segundo
              </p>
            </div>
          )}

          {node.type === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transferir a
              </label>
              <TextInput
                value={config.transfer_to || ''}
                onChange={(e) => updateConfig('transfer_to', e.target.value)}
                placeholder="Nombre del agente o departamento"
              />
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between w-full">
          <Button color="failure" onClick={onDelete}>
            <Icon icon="solar:trash-bin-trash-bold" className="mr-1" width={16} />
            Eliminar
          </Button>
          <div className="flex gap-2">
            <Button color="gray" onClick={onClose}>Cancelar</Button>
            <Button color="blue" onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

// ==================== WRAPPER CON PROVIDER ====================

const FlowEditorWrapper: React.FC = () => (
  <ReactFlowProvider>
    <FlowEditor />
  </ReactFlowProvider>
);

export default FlowEditorWrapper;

/**
 * Chatbot flow editor re-implemented with @joint/core (free).
 * Visual design inspired by clientIO/joint-demos marketing-automation.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, Modal, TextInput, Textarea, Select, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { dia, shapes } from '@joint/core';

import chatbotService, {
  Chatbot,
  ChatbotFlow,
  ChatbotNode as BackendChatbotNode,
  NodeType,
  NodeConfig,
} from '../../../../services/chatbotService';
import guroToast, { GuroToastContainer } from 'src/components/GuroToast/GuroToast';
import { useEmpleadosBroker } from '../../../../hooks/useAdminCrudApi';
import ChatbotSettings from './ChatbotSettings';
import ChatbotAnalyticsPanel from './ChatbotAnalyticsPanel';
import Navigator from './Navigator';

import { Theme, nodeTypePalette, type NodeTypeId } from './jointjs/theme';
import { ChatbotNode, ChatbotBranchNode, ChatbotEdge } from './jointjs/shapes';
import cubicConnector from './jointjs/connector';
import { autoLayout, applyLayout } from './jointjs/layout';

/** Node types that use the hexagonal branch shape. */
const BRANCH_TYPES = new Set<NodeTypeId>(['condition', 'options', 'question']);

// ────────────────────────── palette ──────────────────────────

interface PaletteItem {
  type: NodeTypeId;
  label: string;
  icon: string;
  description: string;
}

const PALETTE: PaletteItem[] = [
  { type: 'start',         label: 'Inicio',            icon: 'solar:play-circle-bold',        description: 'Punto de inicio' },
  { type: 'message',       label: 'Mensaje',           icon: 'solar:chat-round-dots-bold',    description: 'Enviar texto' },
  { type: 'options',       label: 'Opciones',          icon: 'solar:list-check-bold',         description: 'Menú con opciones' },
  { type: 'input',         label: 'Entrada',           icon: 'solar:text-field-bold',         description: 'Capturar respuesta' },
  { type: 'condition',     label: 'Condición',         icon: 'solar:branching-paths-up-bold', description: 'Bifurcación Sí/No' },
  { type: 'action',        label: 'Acción',            icon: 'solar:bolt-bold',               description: 'Acción automática' },
  { type: 'ai_response',   label: 'IA',                icon: 'solar:magic-stick-3-bold',      description: 'Respuesta IA' },
  { type: 'transfer',      label: 'Transferir',        icon: 'solar:user-hand-up-bold',       description: 'A agente humano' },
  { type: 'delay',         label: 'Espera',            icon: 'solar:clock-circle-bold',       description: 'Pausa antes de seguir' },
  { type: 'end',           label: 'Fin',               icon: 'solar:stop-circle-bold',        description: 'Terminar conversación' },
  { type: 'policy_lookup', label: 'Consultar Póliza',  icon: 'solar:shield-check-bold',       description: 'Consulta por documento' },
  { type: 'add_tag',       label: 'Añadir Etiqueta',   icon: 'solar:tag-horizontal-bold',     description: 'Etiquetar conversación' },
  { type: 'remove_tag',    label: 'Quitar Etiqueta',   icon: 'solar:tag-horizontal-bold-duotone', description: 'Desetiquetar' },
  { type: 'media',         label: 'Multimedia',        icon: 'solar:gallery-bold',            description: 'Imagen/video/doc' },
];

// ────────────────────────── main component ──────────────────────────

const FlowEditorJointJS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paperContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<dia.Graph | null>(null);
  const paperRef = useRef<dia.Paper | null>(null);
  const minimapPaperRef = useRef<dia.Paper | null>(null);
  const minimapContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<ChatbotFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedElement, setSelectedElement] = useState<dia.Element | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [activeTab, setActiveTab] = useState<'flows' | 'settings' | 'analytics'>('flows');
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [showNavigator, setShowNavigator] = useState(true);
  const [isPanningMinimap, setIsPanningMinimap] = useState(false);
  // Overlay for + buttons under each node (screen coords)
  const [nodePositions, setNodePositions] = useState<Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    nodeType: NodeTypeId;
    outgoing: Array<{ targetId: string; branch?: 'true' | 'false' | string }>;
  }>>([]);
  const [addMenuFor, setAddMenuFor] = useState<{ id: string; branch?: string; x: number; y: number } | null>(null);
  // Drag-from-+ state: { sourceId, branch, x, y } during an active drag
  const [plusDrag, setPlusDrag] = useState<{ sourceId: string; branch?: string; x: number; y: number; fromX: number; fromY: number } | null>(null);

  // Detect dark mode so palette tints adapt without CSS fighting inline styles
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ── load chatbot + flows ──
  useEffect(() => {
    const load = async () => {
      const id = searchParams.get('id');
      if (!id) {
        guroToast.error('Falta el ID del chatbot');
        setLoading(false);
        return;
      }
      try {
        const [cRes, fRes] = await Promise.all([
          chatbotService.getChatbot(parseInt(id)),
          chatbotService.getFlows(parseInt(id)),
        ]);
        setChatbot(cRes.data || null);
        const fs = fRes.data || [];
        setFlows(fs);
        if (fs.length) setCurrentFlow(fs[0]);
      } catch (e) {
        console.error(e);
        guroToast.error('Error cargando el chatbot');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams]);

  // ── init JointJS paper ──
  useEffect(() => {
    if (loading || !paperContainerRef.current) return;

    const graph = new dia.Graph({}, { cellNamespace: shapes });
    graphRef.current = graph;

    const paper = new dia.Paper({
      el: paperContainerRef.current,
      model: graph,
      width: '100%',
      height: '100%',
      gridSize: 16,
      drawGrid: { name: 'dot', args: { color: Theme.GridColor, thickness: 1 } },
      background: { color: Theme.BackgroundColor },
      cellViewNamespace: shapes,
      interactive: {
        linkMove: false,
        elementMove: true,
      },
      linkPinning: false,
      defaultRouter: { name: 'normal' },
    });

    paperRef.current = paper;

    // Click on element → select
    paper.on('element:pointerdown', (view) => {
      setSelectedElement(view.model as dia.Element);
    });
    paper.on('blank:pointerdown', (evt, x, y) => {
      setSelectedElement(null);
      startPan(evt, x, y);
    });

    // Wheel zoom
    paper.on('blank:mousewheel', (evt: any, x: number, y: number, delta: number) => {
      evt.preventDefault();
      zoomAt(delta > 0 ? 1.1 : 1 / 1.1, x, y);
    });
    paper.on('cell:mousewheel', (_cv: any, evt: any, x: number, y: number, delta: number) => {
      evt.preventDefault();
      zoomAt(delta > 0 ? 1.1 : 1 / 1.1, x, y);
    });

    // Connection event handlers
    paper.on('link:connect', (linkView) => {
      console.log('Link connected:', linkView.model);
      // Update minimap when new link is created
      updateMinimapViewport();
    });

    paper.on('link:disconnect', (linkView) => {
      console.log('Link disconnected:', linkView.model);
      // Update minimap when link is removed
      updateMinimapViewport();
    });

    // Update minimap viewport when translated/scaled
    paper.on('translate scale', updateMinimapViewport);

    // Track node positions for the "+" overlay
    const updateNodePositions = () => {
      const g = graphRef.current;
      const p = paperRef.current;
      if (!g || !p) return;
      const scale = (p as any).scale().sx;
      const t = (p as any).translate();
      // Build outgoing map from links (regular + branch labels)
      const outgoingByNode = new Map<string, Array<{ targetId: string; branch?: string }>>();
      g.getLinks().forEach((link) => {
        const src = String((link.get('source') as any)?.id || '');
        const tgt = String((link.get('target') as any)?.id || '');
        if (!src || !tgt) return;
        const branch = (link.get('branch') as string) || undefined;
        const arr = outgoingByNode.get(src) || [];
        arr.push({ targetId: tgt, branch });
        outgoingByNode.set(src, arr);
      });
      const positions = g.getElements().map((el) => {
        const pos = el.position();
        const size = el.size();
        const id = String(el.id);
        return {
          id,
          x: pos.x * scale + t.tx,
          y: pos.y * scale + t.ty,
          w: size.width * scale,
          h: size.height * scale,
          nodeType: (el.get('nodeType') as NodeTypeId) || 'message',
          outgoing: outgoingByNode.get(id) || [],
        };
      });
      setNodePositions(positions);
    };
    paper.on('translate scale', updateNodePositions);
    graph.on('add remove change:position change:size change:source change:target', updateNodePositions);
    // Initial
    setTimeout(updateNodePositions, 50);

    // Minimap — demo-style: bigger, darker, auto-fits content
    if (minimapContainerRef.current) {
      const mm = new dia.Paper({
        el: minimapContainerRef.current,
        model: graph,
        width: 280,
        height: 180,
        interactive: false,
        background: { color: Theme.ShellSurfaceElevated },
        cellViewNamespace: shapes,
      });
      minimapPaperRef.current = mm;
      fitMinimap();
    }

    return () => {
      paper.remove();
      paperRef.current = null;
      if (minimapPaperRef.current) {
        minimapPaperRef.current.remove();
        minimapPaperRef.current = null;
      }
      graphRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── render flow into graph when currentFlow changes ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !currentFlow) return;
    graph.clear();

    const nodes = currentFlow.nodes || [];
    const nodeById = new Map<number, dia.Element>();

    nodes.forEach((n, i) => {
      const t = normalizeType(n.node_type);
      const Ctor = BRANCH_TYPES.has(t) ? ChatbotBranchNode : ChatbotNode;
      const el = new Ctor({
        position: {
          x: n.position_x || 100 + (i % 4) * 300,
          y: n.position_y || 100 + Math.floor(i / 4) * 120,
        },
      }) as any;
      el.set('backendId', n.id);
      el.set('config', n.config || {});
      el.applyType(t, n.name || '');
      graph.addCell(el);
      nodeById.set(n.id, el);
    });

    nodes.forEach((n) => {
      if (!n.next_node_id) return;
      const src = nodeById.get(n.id);
      const tgt = nodeById.get(n.next_node_id);
      if (!src || !tgt) return;
      const link = new ChatbotEdge({
        source: { id: src.id },
        target: { id: tgt.id },
      });
      (link as any).connector(cubicConnector);
      graph.addCell(link);
    });

    // Render routes from options[].next_node_id (branching menus + conditions)
    nodes.forEach((n) => {
      const cfg = n.config as any;
      const opts = cfg?.options;
      if (Array.isArray(opts)) {
        opts.forEach((opt: any) => {
          if (!opt?.next_node_id) return;
          const src = nodeById.get(n.id);
          const tgt = nodeById.get(opt.next_node_id);
          if (!src || !tgt) return;
          const link = new ChatbotEdge({
            source: { id: src.id },
            target: { id: tgt.id },
            labels: opt.label
              ? [{ attrs: { labelText: { text: String(opt.label).slice(0, 22) } } }]
              : [],
          });
          (link as any).connector(cubicConnector);
          graph.addCell(link);
        });
      }
      // Condition node: true_node_id / false_node_id
      const nt = normalizeType(n.node_type);
      if (nt === 'condition') {
        if (cfg?.true_node_id) {
          const src = nodeById.get(n.id);
          const tgt = nodeById.get(cfg.true_node_id);
          if (src && tgt) {
            const link = new ChatbotEdge({ source: { id: src.id }, target: { id: tgt.id }, labels: [{ attrs: { labelText: { text: 'Sí' } } }] });
            (link as any).set('branch', 'true');
            (link as any).connector(cubicConnector);
            graph.addCell(link);
          }
        }
        if (cfg?.false_node_id) {
          const src = nodeById.get(n.id);
          const tgt = nodeById.get(cfg.false_node_id);
          if (src && tgt) {
            const link = new ChatbotEdge({ source: { id: src.id }, target: { id: tgt.id }, labels: [{ attrs: { labelText: { text: 'No' } } }] });
            (link as any).set('branch', 'false');
            (link as any).connector(cubicConnector);
            graph.addCell(link);
          }
        }
      }
    });

    // Center the flow in the screen
    setTimeout(() => {
      fitToScreen();
      fitMinimap();
      updateMinimapViewport();
    }, 100);
  }, [currentFlow]);

  // ── helpers ──

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const paper = paperRef.current;
    if (!paper) return;
    const current = (paper as any).scale().sx as number;
    const next = Math.max(0.25, Math.min(3, current * factor));
    const localCx = cx;
    const localCy = cy;
    const t = (paper as any).translate();
    const newTx = localCx - ((localCx - t.tx) / current) * next;
    const newTy = localCy - ((localCy - t.ty) / current) * next;
    (paper as any).scale(next, next);
    (paper as any).translate(newTx, newTy);
    setZoom(next);
    updateMinimapViewport();
  }, []);

  const startPan = (evt: any, _x: number, _y: number) => {
    const paper = paperRef.current;
    if (!paper) return;
    const start = { x: evt.clientX, y: evt.clientY };
    const t = (paper as any).translate();
    const startT = { tx: t.tx, ty: t.ty };
    const move = (e: MouseEvent) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      (paper as any).translate(startT.tx + dx, startT.ty + dy);
      updateMinimapViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const mm = minimapPaperRef.current;
    const paper = paperRef.current;
    const container = paperContainerRef.current;
    if (!mm || !paper || !container) return;

    const isViewport = !!(e.target as HTMLElement).closest('[data-mm-viewport]');
    const minimapRect = minimapContainerRef.current!.getBoundingClientRect();
    const ms = (mm as any).scale().sx;
    const mt = (mm as any).translate();
    const ps = (paper as any).scale().sx;
    const pt = (paper as any).translate();
    const startX = e.clientX;
    const startY = e.clientY;
    const startTx = pt.tx;
    const startTy = pt.ty;

    setIsPanningMinimap(true);

    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dwX = dx / ms;
      const dwY = dy / ms;
      (paper as any).translate(startTx - dwX * ps, startTy - dwY * ps);
      updateMinimapViewport();
    };

    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setIsPanningMinimap(false);

      const totalDx = ev.clientX - startX;
      const totalDy = ev.clientY - startY;
      if (!isViewport && Math.abs(totalDx) < 4 && Math.abs(totalDy) < 4) {
        // Click on background → center viewport on clicked point
        const mx = startX - minimapRect.left;
        const my = startY - minimapRect.top;
        const wx = (mx - mt.tx) / ms;
        const wy = (my - mt.ty) / ms;
        const containerRect = container.getBoundingClientRect();
        const newTx = containerRect.width / 2 - wx * ps;
        const newTy = containerRect.height / 2 - wy * ps;
        (paper as any).translate(newTx, newTy);
        updateMinimapViewport();
      }
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const fitMinimap = () => {
    const graph = graphRef.current;
    const mm = minimapPaperRef.current;
    if (!graph || !mm) return;
    const bbox = graph.getBBox();
    if (!bbox) return;
    const pad = 20;
    const w = Math.max(bbox.width + pad * 2, 1);
    const h = Math.max(bbox.height + pad * 2, 1);
    const sx = 280 / w;
    const sy = 180 / h;
    const s = Math.min(sx, sy);
    (mm as any).scale(s, s);
    (mm as any).translate(-bbox.x * s + pad * s, -bbox.y * s + pad * s);
  };

  const updateMinimapViewport = () => {
    const paper = paperRef.current;
    const mm = minimapPaperRef.current;
    if (!paper || !mm || !minimapContainerRef.current) return;
    const pt = (paper as any).translate();
    const ps = (paper as any).scale().sx;
    const el = paperContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const worldX = -pt.tx / ps;
    const worldY = -pt.ty / ps;
    const worldW = rect.width / ps;
    const worldH = rect.height / ps;
    viewportRef.current = { x: worldX, y: worldY, w: worldW, h: worldH };
    // draw a rect as a DOM overlay on the minimap instead of a cell
    const overlay = minimapContainerRef.current.querySelector<HTMLDivElement>('[data-mm-viewport]');
    if (!overlay) return;
    const ms = (mm as any).scale().sx;
    const mt = (mm as any).translate();
    overlay.style.left = `${worldX * ms + mt.tx}px`;
    overlay.style.top = `${worldY * ms + mt.ty}px`;
    overlay.style.width = `${worldW * ms}px`;
    overlay.style.height = `${worldH * ms}px`;
  };

  
  const fitToScreen = () => {
    const paper = paperRef.current;
    const graph = graphRef.current;
    if (!paper || !graph) return;
    const bbox = graph.getBBox();
    if (!bbox || (bbox.width === 0 && bbox.height === 0)) {
      // If graph is empty, center the view
      const el = paperContainerRef.current!;
      const rect = el.getBoundingClientRect();
      (paper as any).scale(1, 1);
      (paper as any).translate(rect.width / 2 - Theme.NodeWidth / 2, rect.height / 2 - Theme.NodeHeight / 2);
      setZoom(1);
      updateMinimapViewport();
      return;
    }
    const el = paperContainerRef.current!;
    const rect = el.getBoundingClientRect();
    const pad = 80;
    const sx = (rect.width - pad * 2) / bbox.width;
    const sy = (rect.height - pad * 2) / bbox.height;
    const s = Math.min(Math.min(sx, sy), 1);
    (paper as any).scale(s, s);
    // Center the bbox in the viewport (both axes)
    const scaledW = bbox.width * s;
    const scaledH = bbox.height * s;
    const tx = (rect.width - scaledW) / 2 - bbox.x * s;
    const ty = (rect.height - scaledH) / 2 - bbox.y * s;
    (paper as any).translate(tx, ty);
    setZoom(s);
    updateMinimapViewport();
  };

  const handleDeleteFlow = async () => {
    if (!currentFlow) return;
    const flowToDelete = currentFlow;
    if (!window.confirm(`¿Eliminar el flujo "${flowToDelete.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await chatbotService.deleteFlow(flowToDelete.id);
      if (res?.success === false) {
        guroToast.error(res?.message || 'No se pudo eliminar el flujo');
        return;
      }
      const remaining = flows.filter((f) => f.id !== flowToDelete.id);
      setFlows(remaining);
      setCurrentFlow(remaining[0] || null);
      if (graphRef.current) graphRef.current.clear();
      guroToast.success('Flujo eliminado');
    } catch (e: any) {
      console.error('[deleteFlow] error:', e);
      const msg = e?.response?.data?.message || e?.message || 'Error desconocido';
      guroToast.error(`Error al eliminar: ${msg}`);
    }
  };

  const handleCreateFlow = async () => {
    if (!chatbot || !newFlowName.trim()) return;
    try {
      const res = await chatbotService.createFlow(chatbot.id, { name: newFlowName.trim() });
      const created = res.data;
      if (created) {
        setFlows((prev) => [...prev, created]);
        setCurrentFlow(created);
        setShowNewFlowModal(false);
        setNewFlowName('');
        guroToast.success('Flujo creado');
      }
    } catch (e) {
      console.error(e);
      guroToast.error('Error creando el flujo');
    }
  };

  const handleAutoLayout = async () => {
    const graph = graphRef.current;
    if (!graph) return;
    try {
      const pos = await autoLayout(graph, { direction: 'DOWN' });
      applyLayout(graph, pos);
      fitToScreen();
      fitMinimap();
      guroToast.success('Auto-layout aplicado');
    } catch (e) {
      console.error(e);
      guroToast.error('Error en auto-layout');
    }
  };

  // ── drop from palette ──
  const onPaletteDragStart = (e: React.DragEvent, type: NodeTypeId) => {
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onPaperDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onPaperDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType') as NodeTypeId;
    if (!type) return;
    const paper = paperRef.current;
    if (!paper) return;
    const point = (paper as any).clientToLocalPoint({ x: e.clientX, y: e.clientY });
    createNode(type, point);
  };

  const createNode = (type: NodeTypeId, point: { x: number; y: number }) => {
    const graph = graphRef.current;
    if (!graph) return;
    const Ctor = BRANCH_TYPES.has(type) ? ChatbotBranchNode : ChatbotNode;
    const el = new Ctor({ position: { x: point.x - Theme.NodeWidth / 2, y: point.y - Theme.NodeHeight / 2 } }) as any;
    el.applyType(type, nodeTypePalette[type].typeLabel);
    el.set('config', {});
    graph.addCell(el);
    setSelectedElement(el);
    return el;
  };

  // Create a new node below the source and connect them.
  // If sourceId === '__empty__', create the first node centered (no link).
  // If branch is provided ('true'/'false' etc), link is labeled and tagged.
  const createConnectedNode = (sourceId: string, type: NodeTypeId, branch?: string) => {
    const graph = graphRef.current;
    const paper = paperRef.current;
    if (!graph || !paper) return;

    if (sourceId === '__empty__') {
      const rect = paperContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = (paper as any).scale().sx;
      const t = (paper as any).translate();
      const localPoint = {
        x: (rect.width / 2 - t.tx) / scale,
        y: (rect.height / 2 - t.ty) / scale,
      };
      createNode(type, localPoint);
      setAddMenuFor(null);
      setTimeout(() => fitToScreen(), 50);
      return;
    }

    const source = graph.getCell(sourceId) as dia.Element;
    if (!source) return;
    const srcPos = source.position();
    const srcSize = source.size();
    // Offset left/right for branches so Sí/No don't overlap
    const offsetX = branch === 'false' ? 180 : branch === 'true' ? -180 : 0;
    const newPos = {
      x: srcPos.x + srcSize.width / 2 + offsetX,
      y: srcPos.y + srcSize.height + 80 + Theme.NodeHeight / 2,
    };
    const newEl = createNode(type, newPos);
    if (!newEl) return;
    const linkAttrs: any = {
      source: { id: source.id },
      target: { id: newEl.id },
    };
    if (branch === 'true' || branch === 'false') {
      linkAttrs.labels = [{ attrs: { labelText: { text: branch === 'true' ? 'Sí' : 'No' } } }];
    }
    const link = new ChatbotEdge(linkAttrs);
    if (branch) (link as any).set('branch', branch);
    (link as any).connector(cubicConnector);
    graph.addCell(link);
    setAddMenuFor(null);
  };

  // Connect an existing node as the target of a + drag
  const connectExistingNode = (sourceId: string, targetId: string, branch?: string) => {
    const graph = graphRef.current;
    if (!graph || sourceId === targetId) return;
    // Prevent duplicates
    const exists = graph.getLinks().some((l) => {
      const s = String((l.get('source') as any)?.id || '');
      const t = String((l.get('target') as any)?.id || '');
      const b = (l.get('branch') as string) || undefined;
      return s === sourceId && t === targetId && b === branch;
    });
    if (exists) {
      guroToast.error('Ya existe esta conexión');
      return;
    }
    const linkAttrs: any = {
      source: { id: sourceId },
      target: { id: targetId },
    };
    if (branch === 'true' || branch === 'false') {
      linkAttrs.labels = [{ attrs: { labelText: { text: branch === 'true' ? 'Sí' : 'No' } } }];
    }
    const link = new ChatbotEdge(linkAttrs);
    if (branch) (link as any).set('branch', branch);
    (link as any).connector(cubicConnector);
    graph.addCell(link);
  };

  // ── save to backend ──
  const handleSave = async () => {
    console.log('[handleSave] called. currentFlow:', currentFlow?.id, 'graph:', !!graphRef.current, 'saving:', saving);
    if (!currentFlow) {
      guroToast.error('No hay flujo seleccionado para guardar');
      return;
    }
    if (!graphRef.current) {
      guroToast.error('El editor no está listo aún');
      return;
    }
    setSaving(true);
    guroToast.info('Guardando flujo...');
    try {
      const graph = graphRef.current;
      const elements = graph.getElements() as dia.Element[];
      const links = graph.getLinks();
      console.log('[handleSave] elements:', elements.length, 'links:', links.length);
      if (elements.length === 0) {
        guroToast.error('No hay nodos que guardar. Añade al menos un nodo.');
        setSaving(false);
        return;
      }

      // Build backend payload for each element
      const nodes: Partial<BackendChatbotNode>[] = [];
      const elByLocalId = new Map<string | number, dia.Element>();
      for (const el of elements) {
        elByLocalId.set(String(el.id), el);
      }

      // First pass: create/update nodes (without next_node_id)
      const localToBackendId = new Map<string | number, number>();
      for (const el of elements) {
        const existingBackendId: number | undefined = el.get('backendId');
        const pos = el.position();
        const payload = {
          node_type: (el.get('nodeType') as NodeType) || 'message',
          name: String(el.attr('label/text') || ''),
          config: el.get('config') || {},
          position_x: pos.x,
          position_y: pos.y,
        };
        if (existingBackendId) {
          await chatbotService.updateNode(existingBackendId, payload as any);
          localToBackendId.set(String(el.id), existingBackendId);
        } else {
          const res = await chatbotService.createNode(currentFlow.id, payload as any);
          const id = res.data?.id;
          if (id) {
            el.set('backendId', id);
            localToBackendId.set(String(el.id), id);
          }
        }
        nodes.push(payload as any);
      }

      // Second pass: wire next_node_id from links
      for (const link of links) {
        const srcLocal = (link.get('source') as any)?.id;
        const tgtLocal = (link.get('target') as any)?.id;
        const srcBackend = localToBackendId.get(String(srcLocal));
        const tgtBackend = localToBackendId.get(String(tgtLocal));
        if (srcBackend && tgtBackend) {
          await chatbotService.updateNode(srcBackend, { next_node_id: tgtBackend } as any);
        }
      }

      // Create triggers from the start node's keywords / first_message flag
      try {
        const startEl = elements.find((el) => (el.get('nodeType') as NodeTypeId) === 'start');
        if (startEl && chatbot && currentFlow) {
          const startCfg = (startEl.get('config') as any) || {};
          if (startCfg.keywords && String(startCfg.keywords).trim()) {
            await chatbotService.createTrigger(chatbot.id, {
              flow_id: currentFlow.id,
              trigger_type: 'keyword',
              trigger_value: String(startCfg.keywords).trim(),
              is_case_sensitive: !!startCfg.case_sensitive,
              priority: 50,
            } as any);
          }
          if (startCfg.trigger_first_message) {
            await chatbotService.createTrigger(chatbot.id, {
              flow_id: currentFlow.id,
              trigger_type: 'first_message',
              trigger_value: '',
              is_case_sensitive: false,
              priority: 100,
            } as any);
          }
        }
      } catch (triggerErr) {
        console.log('Trigger create skipped/failed (likely duplicate):', triggerErr);
      }

      guroToast.success('Flujo guardado');
    } catch (e: any) {
      console.error('[handleSave] error:', e);
      const serverMsg =
        e?.response?.data?.message ||
        (e?.response?.data?.errors && JSON.stringify(e.response.data.errors)) ||
        e?.message ||
        'Error desconocido';
      guroToast.error(`Error al guardar: ${serverMsg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── render ──
  if (loading) {
    return (
      <div className="chatbot-editor-root w-full h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="chatbot-editor-root w-full h-screen flex flex-col bg-[#0A0A0A] text-[#F3F4F6] overflow-hidden">
      {/* Toast container (BlankLayout does not include one) */}
      <GuroToastContainer />
      {/* Top bar */}
      <div className="h-14 border-b border-[#1F1F1F] bg-[#111111] flex items-center gap-3 px-4 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-[#1F1F1F] text-[#9CA3AF] hover:text-white"
          title="Volver"
        >
          <Icon icon="solar:arrow-left-linear" width={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{chatbot?.name || 'Chatbot'}</h1>
          <p className="text-xs text-[#9CA3AF] truncate">
            {activeTab === 'flows'
              ? `${flows.length} flujo${flows.length === 1 ? '' : 's'}${currentFlow ? ' · ' + currentFlow.name : ''}`
              : activeTab === 'settings'
                ? 'Configuración del chatbot'
                : 'Análisis y métricas'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-0.5">
          {([
            { id: 'flows', icon: 'solar:diagram-up-linear', tip: 'Editor' },
            { id: 'settings', icon: 'solar:settings-linear', tip: 'Configuración' },
            { id: 'analytics', icon: 'solar:chart-2-linear', tip: 'Análisis' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              title={t.tip}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === t.id ? 'bg-[#1F1F1F] text-white shadow-inner' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <Icon icon={t.icon} width={14} />
              <span className="hidden sm:inline">{t.tip}</span>
            </button>
          ))}
        </div>

        {activeTab === 'flows' && (
          <>
            {flows.length > 1 && (
              <Select
                sizing="sm"
                value={currentFlow?.id || ''}
                onChange={(e) => {
                  const f = flows.find((x) => x.id === Number(e.target.value));
                  if (f) setCurrentFlow(f);
                }}
                className="bg-[#0A0A0A] border-[#1F1F1F] text-white"
              >
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            )}

            <button
              onClick={() => setShowNewFlowModal(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1F1F1F] bg-[#161616] hover:bg-[#1F1F1F] text-white flex items-center gap-1.5"
            >
              <Icon icon="solar:add-circle-linear" width={14} />
              Nuevo flujo
            </button>

            {currentFlow && (
              <button
                onClick={handleDeleteFlow}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-900/40 bg-red-900/10 hover:bg-red-900/30 text-red-400 hover:text-red-300 flex items-center gap-1.5"
                title={`Eliminar "${currentFlow.name}"`}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={14} />
                Eliminar flujo
              </button>
            )}

            <div className="h-6 w-px bg-[#1F1F1F]" />

            <button onClick={handleAutoLayout} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1F1F1F] bg-[#161616] hover:bg-[#1F1F1F] text-white flex items-center gap-1.5">
              <Icon icon="solar:magnet-bold" width={14} />
              Auto layout
            </button>
            <button onClick={fitToScreen} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1F1F1F] bg-[#161616] hover:bg-[#1F1F1F] text-white flex items-center gap-1.5">
              <Icon icon="solar:maximize-square-linear" width={14} />
              Ajustar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
            >
              {saving ? <Spinner size="sm" /> : <Icon icon="solar:diskette-bold" width={14} />}
              Guardar
            </button>
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'settings' && chatbot && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
            <div className="max-w-4xl mx-auto">
              <ChatbotSettings chatbot={chatbot} onUpdate={(updated: Chatbot) => setChatbot(updated)} />
            </div>
          </div>
        )}
        {activeTab === 'analytics' && chatbot && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
            <div className="max-w-6xl mx-auto">
              <ChatbotAnalyticsPanel chatbotId={chatbot.id} chatbotName={chatbot.name} />
            </div>
          </div>
        )}

        {activeTab === 'flows' && (
          <>
        {/* Palette */}
        {showPalette && (
          <aside className="w-64 border-r border-[#1F1F1F] bg-[#111111] flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Añadir nodo</h2>
              <button onClick={() => setShowPalette(false)} className="text-[#9CA3AF] hover:text-white" title="Ocultar">
                <Icon icon="solar:sidebar-minimalistic-linear" width={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {PALETTE.map((it) => {
                const palette = nodeTypePalette[it.type];
                return (
                  <div
                    key={it.type}
                    draggable
                    onDragStart={(e) => onPaletteDragStart(e, it.type)}
                    className="px-3 py-2.5 rounded-lg border border-[#1F1F1F] bg-[#161616] hover:border-[#2F2F2F] hover:bg-[#1A1A1A] cursor-grab active:cursor-grabbing flex items-center gap-3 transition-all"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{ background: isDark ? palette.tint : palette.accent + '18', borderColor: palette.accent + '44' }}
                    >
                      <Icon icon={it.icon} width={16} style={{ color: palette.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{it.label}</div>
                      <div className="text-[11px] text-[#9CA3AF] truncate">{it.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
        {!showPalette && (
          <button
            onClick={() => setShowPalette(true)}
            className="absolute left-2 top-20 z-10 w-8 h-8 rounded-lg bg-[#161616] border border-[#1F1F1F] hover:bg-[#1F1F1F] flex items-center justify-center text-[#9CA3AF] hover:text-white"
            title="Mostrar paleta"
          >
            <Icon icon="solar:sidebar-minimalistic-linear" width={16} />
          </button>
        )}

        {/* Paper area */}
        <main className="flex-1 relative overflow-hidden">
          <div
            ref={paperContainerRef}
            className="w-full h-full"
            onDragOver={onPaperDragOver}
            onDrop={onPaperDrop}
          />

          {/* Empty-state: big centered + to create the first node */}
          {nodePositions.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-center gap-4">
                <button
                  onClick={(e) => {
                    const rect = paperContainerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setAddMenuFor({
                      id: '__empty__',
                      x: rect.width / 2,
                      y: rect.height / 2 + 60,
                    });
                    e.stopPropagation();
                  }}
                  className="w-20 h-20 rounded-full bg-[#1A1A1A] border-2 border-dashed border-[#3F3F46] hover:border-[#60A5FA] hover:bg-[#1F1F1F] flex items-center justify-center text-[#9CA3AF] hover:text-[#60A5FA] transition-all shadow-xl"
                  title="Crear primer nodo"
                >
                  <Icon icon="solar:add-circle-linear" width={40} />
                </button>
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">Empieza tu flujo</div>
                  <div className="text-xs text-[#9CA3AF] mt-1">Haz clic en + para añadir el primer nodo<br />o arrastra uno desde la paleta</div>
                </div>
              </div>
            </div>
          )}

          {/* "+" buttons overlay — only on leaf nodes. Branch nodes show Sí/No. */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Dashed connector lines + drag preview */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              {nodePositions.flatMap((p) => {
                const isCondition = p.nodeType === 'condition';
                const hasTrue = p.outgoing.some((o) => o.branch === 'true');
                const hasFalse = p.outgoing.some((o) => o.branch === 'false');
                const hasAny = p.outgoing.length > 0;
                const lines: JSX.Element[] = [];
                if (isCondition) {
                  if (!hasTrue) {
                    lines.push(
                      <line key={`ln-t-${p.id}`} x1={p.x + p.w / 2 - 40} y1={p.y + p.h} x2={p.x + p.w / 2 - 40} y2={p.y + p.h + 28} stroke="#2F2F2F" strokeWidth="1.5" strokeDasharray="3,3" />
                    );
                  }
                  if (!hasFalse) {
                    lines.push(
                      <line key={`ln-f-${p.id}`} x1={p.x + p.w / 2 + 40} y1={p.y + p.h} x2={p.x + p.w / 2 + 40} y2={p.y + p.h + 28} stroke="#2F2F2F" strokeWidth="1.5" strokeDasharray="3,3" />
                    );
                  }
                } else if (!hasAny) {
                  lines.push(
                    <line key={`ln-${p.id}`} x1={p.x + p.w / 2} y1={p.y + p.h} x2={p.x + p.w / 2} y2={p.y + p.h + 12} stroke="#2F2F2F" strokeWidth="1.5" strokeDasharray="3,3" />
                  );
                }
                return lines;
              })}
              {/* Drag preview line */}
              {plusDrag && (
                <line
                  x1={plusDrag.fromX}
                  y1={plusDrag.fromY}
                  x2={plusDrag.x}
                  y2={plusDrag.y}
                  stroke="#60A5FA"
                  strokeWidth="2"
                  strokeDasharray="5,4"
                />
              )}
            </svg>

            {nodePositions.map((p) => {
              const isCondition = p.nodeType === 'condition';
              const hasTrue = p.outgoing.some((o) => o.branch === 'true');
              const hasFalse = p.outgoing.some((o) => o.branch === 'false');
              const hasAny = p.outgoing.length > 0;

              const renderPlus = (opts: {
                key: string;
                left: number;
                top: number;
                branch?: string;
                label?: string;
              }) => (
                <React.Fragment key={opts.key}>
                  {opts.label && (
                    <div
                      className="absolute pointer-events-none px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      style={{ left: opts.left - 15, top: opts.top - 22 }}
                    >
                      {opts.label}
                    </div>
                  )}
                  <button
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      e.preventDefault();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const paperRect = paperContainerRef.current?.getBoundingClientRect();
                      if (!paperRect) return;
                      const fromX = opts.left;
                      const fromY = opts.top + 14;
                      let dragged = false;
                      const onMove = (ev: MouseEvent) => {
                        const dx = ev.clientX - startX;
                        const dy = ev.clientY - startY;
                        if (!dragged && Math.abs(dx) + Math.abs(dy) < 6) return;
                        dragged = true;
                        setPlusDrag({
                          sourceId: p.id,
                          branch: opts.branch,
                          fromX,
                          fromY,
                          x: ev.clientX - paperRect.left,
                          y: ev.clientY - paperRect.top,
                        });
                      };
                      const onUp = (ev: MouseEvent) => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                        if (!dragged) {
                          // Click: open add-node menu
                          setAddMenuFor({ id: p.id, branch: opts.branch, x: opts.left, y: opts.top + 16 });
                        } else {
                          // Drag release: check if over a node
                          const dropX = ev.clientX - paperRect.left;
                          const dropY = ev.clientY - paperRect.top;
                          const target = nodePositions.find(
                            (n) => n.id !== p.id && dropX >= n.x && dropX <= n.x + n.w && dropY >= n.y && dropY <= n.y + n.h
                          );
                          if (target) {
                            connectExistingNode(p.id, target.id, opts.branch);
                          }
                        }
                        setPlusDrag(null);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                    className="absolute pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2F2F2F] hover:bg-[#2F2F2F] hover:border-[#60A5FA] text-[#9CA3AF] hover:text-white transition-all shadow-lg cursor-grab active:cursor-grabbing"
                    style={{
                      left: opts.left - 14,
                      top: opts.top,
                    }}
                    title="Clic: añadir nodo · Arrastrar: conectar a existente"
                  >
                    <Icon icon="solar:add-circle-linear" width={16} />
                  </button>
                </React.Fragment>
              );

              if (isCondition) {
                const nodes: JSX.Element[] = [];
                if (!hasTrue) {
                  nodes.push(
                    renderPlus({
                      key: `plus-t-${p.id}`,
                      left: p.x + p.w / 2 - 40,
                      top: p.y + p.h + 30,
                      branch: 'true',
                      label: 'Sí',
                    }),
                  );
                }
                if (!hasFalse) {
                  nodes.push(
                    renderPlus({
                      key: `plus-f-${p.id}`,
                      left: p.x + p.w / 2 + 40,
                      top: p.y + p.h + 30,
                      branch: 'false',
                      label: 'No',
                    }),
                  );
                }
                return nodes;
              }

              if (hasAny) return null; // non-leaf, non-condition: no +
              return renderPlus({
                key: `plus-${p.id}`,
                left: p.x + p.w / 2,
                top: p.y + p.h + 14,
              });
            })}
          </div>

          {/* Add-node menu (shown when + clicked) */}
          {addMenuFor && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setAddMenuFor(null)}
              />
              <div
                className="absolute z-30 w-64 max-h-[340px] overflow-y-auto rounded-lg bg-[#111111] border border-[#2F2F2F] shadow-2xl py-1.5"
                style={{
                  left: Math.min(addMenuFor.x - 128, (paperContainerRef.current?.clientWidth || 800) - 268),
                  top: addMenuFor.y,
                }}
              >
                <div className="px-3 py-2 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide border-b border-[#1F1F1F]">
                  Añadir siguiente paso
                </div>
                {PALETTE.filter((it) => it.type !== 'start').map((it) => {
                  const palette = nodeTypePalette[it.type];
                  return (
                    <button
                      key={it.type}
                      onClick={() => createConnectedNode(addMenuFor.id, it.type, addMenuFor.branch)}
                      className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#1F1F1F] transition-colors text-left"
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                        style={{ background: isDark ? palette.tint : palette.accent + '18', borderColor: palette.accent + '44' }}
                      >
                        <Icon icon={it.icon} width={14} style={{ color: palette.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{it.label}</div>
                        <div className="text-[10px] text-[#9CA3AF] truncate">{it.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Navigator (minimap + zoom slider + fit buttons) */}
          <Navigator
            show={showNavigator}
            zoom={zoom}
            minimapRef={minimapContainerRef}
            onMinimapMouseDown={handleMinimapMouseDown}
            isPanningMinimap={isPanningMinimap}
            onZoomChange={(v) => {
              const paper = paperRef.current;
              if (!paper) return;
              const current = (paper as any).scale().sx as number;
              const factor = v / current;
              const el = paperContainerRef.current!;
              const rect = el.getBoundingClientRect();
              zoomAt(factor, rect.width / 2, rect.height / 2);
            }}
            onFitScreen={fitToScreen}
            onFitWidth={() => {
              const paper = paperRef.current;
              const graph = graphRef.current;
              if (!paper || !graph) return;
              const bbox = graph.getBBox();
              if (!bbox) return;
              const el = paperContainerRef.current!;
              const rect = el.getBoundingClientRect();
              const pad = 60;
              const sx = (rect.width - pad * 2) / bbox.width;
              const s = Math.min(sx, 1.5);
              (paper as any).scale(s, s);
              (paper as any).translate(pad - bbox.x * s, (rect.height - bbox.height * s) / 2 - bbox.y * s);
              setZoom(s);
              updateMinimapViewport();
            }}
            onToggleMinimap={() => setShowNavigator((v) => !v)}
          />
        </main>

        {/* Inspector */}
        <InspectorPanel
          element={selectedElement}
          onChange={() => {
            // trigger re-render & minimap refresh
            setSelectedElement(selectedElement);
          }}
          onDelete={() => {
            if (!selectedElement) return;
            selectedElement.remove();
            setSelectedElement(null);
          }}
          flows={flows}
          currentFlowId={currentFlow?.id}
        />
          </>
        )}
      </div>

      {/* New flow modal */}
      <Modal show={showNewFlowModal} onClose={() => setShowNewFlowModal(false)} size="md">
        <Modal.Header>Crear nuevo flujo</Modal.Header>
        <Modal.Body>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del flujo</label>
          <TextInput
            placeholder="Ej: Flujo de ventas"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            autoFocus
          />
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowNewFlowModal(false)}>Cancelar</Button>
          <Button color="blue" onClick={handleCreateFlow} disabled={!newFlowName.trim()}>
            Crear flujo
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ────────────────────────── inspector panel ──────────────────────────

interface InspectorPanelProps {
  element: dia.Element | null;
  onChange: () => void;
  onDelete: () => void;
  flows: ChatbotFlow[];
  currentFlowId?: number;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ element, onChange, onDelete }) => {
  const { empleados, loading: loadingEmpleados } = useEmpleadosBroker();

  const [name, setName] = useState('');
  const [config, setConfig] = useState<NodeConfig>({});

  useEffect(() => {
    if (!element) return;
    setName(String(element.attr('label/text') || ''));
    setConfig((element.get('config') as NodeConfig) || {});
  }, [element]);

  const nodeType = useMemo<NodeTypeId>(() => {
    return (element?.get('nodeType') as NodeTypeId) || 'message';
  }, [element]);

  if (!element) return null;

  const palette = nodeTypePalette[nodeType];
  const isDark = document.documentElement.classList.contains('dark');

  const commitName = (v: string) => {
    setName(v);
    element.attr('label/text', v);
    onChange();
  };
  const commitConfig = (partial: Partial<NodeConfig>) => {
    const next = { ...config, ...partial };
    setConfig(next);
    element.set('config', next);
    onChange();
  };

  return (
    <aside className="w-[360px] border-l border-[#1F1F1F] bg-[#111111] flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
          style={{ background: isDark ? palette.tint : palette.accent + '18', borderColor: palette.accent + '33' }}
        >
          <Icon icon={palette ? iconForType(nodeType) : 'solar:widget-bold'} width={16} style={{ color: palette.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{palette.typeLabel}</div>
          <div className="text-[11px] text-[#9CA3AF]">ID {String(element.id).slice(0, 8)}</div>
        </div>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-900/20 text-red-400" title="Eliminar">
          <Icon icon="solar:trash-bin-trash-linear" width={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Nombre</label>
          <TextInput sizing="sm" value={name} onChange={(e) => commitName(e.target.value)} placeholder="Ej: Saludo inicial" className="bg-[#1A1A1A] border-[#2F2F2F] text-white" />
        </div>

        {(nodeType === 'message' || nodeType === 'end') && (
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Texto del mensaje</label>
            <Textarea
              rows={4}
              value={(config as any).text || ''}
              onChange={(e) => commitConfig({ text: e.target.value } as any)}
              placeholder="Escribe el mensaje..."
              className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
            />
          </div>
        )}

        {(nodeType === 'options' || nodeType === 'question') && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Pregunta</label>
              <Textarea
                rows={3}
                value={(config as any).text || ''}
                onChange={(e) => commitConfig({ text: e.target.value } as any)}
                placeholder="¿Qué necesitas?"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <OptionsEditor
              options={Array.isArray((config as any).options) ? (config as any).options : []}
              onChange={(opts) => commitConfig({ options: opts } as any)}
            />
          </>
        )}

        {nodeType === 'ai_response' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">System prompt</label>
              <Textarea
                rows={8}
                value={(config as any).system_prompt || (config as any).ai_prompt || ''}
                onChange={(e) => commitConfig({ system_prompt: e.target.value } as any)}
                placeholder="Eres un asistente experto en..."
                className="font-mono text-sm bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Modelo</label>
                <Select
                  sizing="sm"
                  value={(config as any).model || ''}
                  onChange={(e) => commitConfig({ model: e.target.value || undefined } as any)}
                  className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
                >
                  <option value="">Por defecto</option>
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Temperatura</label>
                <TextInput
                  sizing="sm"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={(config as any).temperature ?? 0.7}
                  onChange={(e) => commitConfig({ temperature: parseFloat(e.target.value) } as any)}
                  className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={!!(config as any).conversational}
                onChange={(e) => commitConfig({ conversational: e.target.checked } as any)}
              />
              Modo conversacional (loop)
            </label>

            <TransferRulesEditor
              rules={Array.isArray((config as any).transfer_rules) ? (config as any).transfer_rules : []}
              defaultMessage={(config as any).transfer_default_message || ''}
              empleados={empleados as any[]}
              loadingEmpleados={loadingEmpleados}
              onChangeRules={(rules) => commitConfig({ transfer_rules: rules } as any)}
              onChangeDefaultMessage={(msg) => commitConfig({ transfer_default_message: msg } as any)}
            />
          </>
        )}

        {nodeType === 'transfer' && (
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Asignar a</label>
            {loadingEmpleados ? (
              <Spinner size="sm" />
            ) : (
              <Select
                sizing="sm"
                value={(config as any).transfer_to_user_id?.toString() || ''}
                onChange={(e) => commitConfig({ transfer_to_user_id: Number(e.target.value) || undefined } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="">Primer disponible</option>
                {(empleados as any[]).map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombres} {emp.apellidos || ''}
                  </option>
                ))}
              </Select>
            )}
            <label className="block text-xs font-medium text-[#9CA3AF] mt-3 mb-1">Mensaje</label>
            <Textarea
              rows={2}
              value={(config as any).transfer_message || ''}
              onChange={(e) => commitConfig({ transfer_message: e.target.value } as any)}
              placeholder="Te comunico con un asesor..."
              className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
            />
          </div>
        )}

        {nodeType === 'delay' && (
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Segundos</label>
            <TextInput
              sizing="sm"
              type="number"
              min={0}
              value={(config as any).delay_seconds || ''}
              onChange={(e) => commitConfig({ delay_seconds: parseInt(e.target.value) } as any)}
              className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
            />
          </div>
        )}

        {nodeType === 'start' && (
          <>
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon icon="solar:play-circle-bold" className="text-emerald-400" width={16} />
                <span className="text-xs font-semibold text-emerald-300">Punto de entrada</span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Se activa cuando un mensaje del usuario coincide con alguno de los triggers configurados abajo.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                Palabras clave que activan este flujo
              </label>
              <Textarea
                rows={3}
                value={(config as any).keywords || ''}
                onChange={(e) => commitConfig({ keywords: e.target.value } as any)}
                placeholder="hola, buenos días, hey, hi"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
              <div className="text-[10px] text-[#6B7280] mt-1">
                Separa las palabras con comas. El flujo se activará cuando el usuario escriba alguna de ellas.
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: 'Saludos', keywords: 'hola,buenos días,buenas tardes,buenas noches,hey,hi,hello' },
                  { label: 'Ayuda', keywords: 'ayuda,help,información,info,menu,menú,opciones' },
                  { label: 'Precios', keywords: 'precio,precios,costo,costos,cuánto,tarifa,cotización' },
                  { label: 'Pólizas', keywords: 'póliza,polizas,seguro,consultar,mi seguro' },
                  { label: 'Agente', keywords: 'humano,persona,asesor,agente,operador' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => commitConfig({ keywords: preset.keywords } as any)}
                    className="px-2 py-1 rounded-md text-[10px] font-medium bg-[#1A1A1A] border border-[#2F2F2F] text-[#9CA3AF] hover:text-white hover:border-emerald-500/50 transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!(config as any).trigger_first_message}
                onChange={(e) => commitConfig({ trigger_first_message: e.target.checked } as any)}
              />
              <span>
                Activar con el primer mensaje de contactos nuevos
                <span className="block text-[10px] text-[#6B7280] font-normal mt-0.5">
                  Si está activado, el flujo se ejecuta siempre que un contacto nuevo envíe su primer mensaje, independientemente de las palabras clave.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={(config as any).case_sensitive === true}
                onChange={(e) => commitConfig({ case_sensitive: e.target.checked } as any)}
              />
              <span>
                Sensible a mayúsculas/minúsculas
                <span className="block text-[10px] text-[#6B7280] font-normal mt-0.5">
                  Si está desactivado, "HOLA", "Hola" y "hola" coincidirán todas.
                </span>
              </span>
            </label>
          </>
        )}

        {nodeType === 'input' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Pregunta / prompt</label>
              <Textarea
                rows={3}
                value={(config as any).text || ''}
                onChange={(e) => commitConfig({ text: e.target.value } as any)}
                placeholder="¿Cuál es tu nombre?"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Guardar respuesta en (variable)</label>
              <TextInput
                sizing="sm"
                value={(config as any).variable_name || ''}
                onChange={(e) => commitConfig({ variable_name: e.target.value } as any)}
                placeholder="nombre_cliente"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Tipo de validación</label>
              <Select
                sizing="sm"
                value={(config as any).validation || ''}
                onChange={(e) => commitConfig({ validation: e.target.value || undefined } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="">Ninguna (texto libre)</option>
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="email">Email</option>
                <option value="phone">Teléfono</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Guardar en campo de contacto (opcional)</label>
              <Select
                sizing="sm"
                value={(config as any).contact_field || ''}
                onChange={(e) => commitConfig({ contact_field: e.target.value || undefined } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="">No guardar en contacto</option>
                <option value="first_name">Nombre</option>
                <option value="last_name">Apellido</option>
                <option value="document_id">Documento</option>
                <option value="email">Email</option>
                <option value="phone_secondary">Teléfono secundario</option>
                <option value="company">Empresa</option>
                <option value="city">Ciudad</option>
                <option value="notes">Notas</option>
              </Select>
              <div className="text-[10px] text-[#6B7280] mt-1">Si seleccionas un campo, la respuesta se guardará en el contacto del cliente.</div>
            </div>
          </>
        )}

        {nodeType === 'condition' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Variable a evaluar</label>
              <TextInput
                sizing="sm"
                value={(config as any).variable || ''}
                onChange={(e) => commitConfig({ variable: e.target.value } as any)}
                placeholder="nombre_variable"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Operador</label>
              <Select
                sizing="sm"
                value={(config as any).operator || 'equals'}
                onChange={(e) => commitConfig({ operator: e.target.value } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="equals">Igual a</option>
                <option value="not_equals">Distinto de</option>
                <option value="contains">Contiene</option>
                <option value="greater_than">Mayor que</option>
                <option value="less_than">Menor que</option>
                <option value="exists">Existe</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Valor de comparación</label>
              <TextInput
                sizing="sm"
                value={(config as any).value || ''}
                onChange={(e) => commitConfig({ value: e.target.value } as any)}
                placeholder="valor..."
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
          </>
        )}

        {nodeType === 'action' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Tipo de acción</label>
              <Select
                sizing="sm"
                value={(config as any).action_type || ''}
                onChange={(e) => commitConfig({ action_type: e.target.value } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="">Seleccionar...</option>
                <option value="webhook">Webhook HTTP</option>
                <option value="set_variable">Establecer variable</option>
                <option value="api_call">Llamada API</option>
              </Select>
            </div>
            {(config as any).action_type === 'webhook' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">URL</label>
                  <TextInput
                    sizing="sm"
                    value={(config as any).webhook_url || ''}
                    onChange={(e) => commitConfig({ webhook_url: e.target.value } as any)}
                    placeholder="https://..."
                    className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Método</label>
                  <Select
                    sizing="sm"
                    value={(config as any).webhook_method || 'POST'}
                    onChange={(e) => commitConfig({ webhook_method: e.target.value } as any)}
                    className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                  </Select>
                </div>
              </>
            )}
            {(config as any).action_type === 'set_variable' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Variable</label>
                  <TextInput
                    sizing="sm"
                    value={(config as any).variable || ''}
                    onChange={(e) => commitConfig({ variable: e.target.value } as any)}
                    className="bg-[#1A1A1A] border-[#2F2F2F] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Valor</label>
                  <TextInput
                    sizing="sm"
                    value={(config as any).value || ''}
                    onChange={(e) => commitConfig({ value: e.target.value } as any)}
                    className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
                  />
                </div>
              </>
            )}
          </>
        )}

        {nodeType === 'policy_lookup' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Mensaje para pedir documento</label>
              <Textarea
                rows={2}
                value={(config as any).ask_document_message || ''}
                onChange={(e) => commitConfig({ ask_document_message: e.target.value } as any)}
                placeholder="📋 Para consultar tus pólizas, escribe tu número de documento:"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Campo de validación</label>
              <Select
                sizing="sm"
                value={(config as any).validation_field || 'email'}
                onChange={(e) => commitConfig({ validation_field: e.target.value } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="email">Correo electrónico</option>
                <option value="phone">Teléfono</option>
                <option value="birth_date">Fecha de nacimiento</option>
                <option value="policy_number">Número de póliza</option>
              </Select>
              <div className="text-[10px] text-[#6B7280] mt-1">Campo adicional para verificar identidad tras recibir el documento.</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Mensaje para pedir validación</label>
              <Textarea
                rows={2}
                value={(config as any).ask_validation_message || ''}
                onChange={(e) => commitConfig({ ask_validation_message: e.target.value } as any)}
                placeholder="Perfecto. Ahora escribe tu {validation_label} para verificar:"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Mensaje si la validación falla</label>
              <Textarea
                rows={2}
                value={(config as any).validation_error_message || ''}
                onChange={(e) => commitConfig({ validation_error_message: e.target.value } as any)}
                placeholder="❌ Los datos no coinciden. Intenta de nuevo."
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Mensaje si no hay pólizas</label>
              <Textarea
                rows={2}
                value={(config as any).no_results_message || ''}
                onChange={(e) => commitConfig({ no_results_message: e.target.value } as any)}
                placeholder="No encontré pólizas asociadas a este documento."
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Mensaje introductorio (si hay pólizas)</label>
              <Textarea
                rows={2}
                value={(config as any).success_message || ''}
                onChange={(e) => commitConfig({ success_message: e.target.value } as any)}
                placeholder="✅ Encontré tus pólizas:"
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={(config as any).send_documents !== false}
                onChange={(e) => commitConfig({ send_documents: e.target.checked } as any)}
              />
              Enviar carátulas/documentos cuando el cliente seleccione una póliza
            </label>
          </>
        )}

        {(nodeType === 'add_tag' || nodeType === 'remove_tag') && (
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Etiqueta</label>
            <TextInput
              sizing="sm"
              value={(config as any).tag || ''}
              onChange={(e) => commitConfig({ tag: e.target.value } as any)}
              placeholder="cliente_potencial"
              className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
            />
          </div>
        )}

        {nodeType === 'media' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Tipo</label>
              <Select
                sizing="sm"
                value={(config as any).media_type || 'image'}
                onChange={(e) => commitConfig({ media_type: e.target.value } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              >
                <option value="image">Imagen</option>
                <option value="video">Video</option>
                <option value="document">Documento</option>
                <option value="audio">Audio</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">URL</label>
              <TextInput
                sizing="sm"
                value={(config as any).url || ''}
                onChange={(e) => commitConfig({ url: e.target.value } as any)}
                placeholder="https://..."
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Caption</label>
              <TextInput
                sizing="sm"
                value={(config as any).caption || ''}
                onChange={(e) => commitConfig({ caption: e.target.value } as any)}
                className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

// ────────────────────────── options editor ──────────────────────────

const OptionsEditor: React.FC<{ options: any[]; onChange: (v: any[]) => void }> = ({ options, onChange }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-[#9CA3AF]">Opciones</label>
        <Button
          size="xs"
          onClick={() => onChange([...options, { value: `opt_${Date.now().toString(36)}`, label: '' }])}
          className="bg-[#1A1A1A] hover:bg-[#2F2F2F] text-white border-[#2F2F2F]"
        >
          <Icon icon="solar:add-circle-bold" width={12} className="mr-1" />
          Añadir
        </Button>
      </div>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="p-2 rounded border border-[#2F2F2F] bg-[#161616] space-y-1.5">
            <TextInput
              sizing="sm"
              value={opt.label || ''}
              onChange={(e) => {
                const next = [...options];
                next[i] = { ...next[i], label: e.target.value };
                onChange(next);
              }}
              placeholder="Etiqueta visible"
              className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
            />
            <div className="flex gap-2">
              <TextInput
                sizing="sm"
                value={opt.value || ''}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = { ...next[i], value: e.target.value };
                  onChange(next);
                }}
                placeholder="valor_interno"
                className="flex-1 font-mono text-xs bg-[#1A1A1A] border-[#2F2F2F] text-white"
              />
              <button
                onClick={() => {
                  const next = options.filter((_, j) => j !== i);
                  onChange(next);
                }}
                className="p-2 rounded text-red-400 hover:bg-red-900/20"
              >
                <Icon icon="solar:trash-bin-trash-linear" width={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ────────────────────────── transfer rules editor ──────────────────────────

const TransferRulesEditor: React.FC<{
  rules: any[];
  defaultMessage: string;
  empleados: any[];
  loadingEmpleados: boolean;
  onChangeRules: (v: any[]) => void;
  onChangeDefaultMessage: (v: string) => void;
}> = ({ rules, defaultMessage, empleados, loadingEmpleados, onChangeRules, onChangeDefaultMessage }) => {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
          <Icon icon="solar:transfer-horizontal-bold" width={14} /> Reglas de transferencia
        </span>
        <Button
          size="xs"
          onClick={() =>
            onChangeRules([
              ...rules,
              {
                id: `rule_${Date.now().toString(36)}`,
                name: '',
                description: '',
                user_id: undefined,
                user_name: '',
                message: '',
              },
            ])
          }
          className="bg-amber-600 hover:bg-amber-500 text-white border-amber-500"
        >
          <Icon icon="solar:add-circle-bold" width={12} className="mr-1" />
          Añadir
        </Button>
      </div>
      <div>
        <label className="text-[11px] text-[#9CA3AF]">Mensaje por defecto</label>
        <TextInput
          sizing="sm"
          value={defaultMessage}
          onChange={(e) => onChangeDefaultMessage(e.target.value)}
          placeholder="Un momento, te conecto con un asesor :)"
          className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
        />
      </div>
      {rules.length === 0 && <div className="text-[11px] text-[#9CA3AF] italic">Sin reglas. Usa [TRANSFER] genérico.</div>}
      {rules.map((rule, idx) => (
        <div key={rule.id || idx} className="p-2 bg-[#161616] rounded border border-amber-500/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded">
              [TRANSFER:{rule.id || `r${idx}`}]
            </span>
            <button
              onClick={() => onChangeRules(rules.filter((_, i) => i !== idx))}
              className="text-red-400 hover:bg-red-900/20 p-1 rounded"
            >
              <Icon icon="solar:trash-bin-trash-linear" width={12} />
            </button>
          </div>
          <TextInput
            sizing="sm"
            value={rule.name || ''}
            onChange={(e) => {
              const next = [...rules];
              next[idx] = { ...next[idx], name: e.target.value };
              onChangeRules(next);
            }}
            placeholder="Nombre (ej: Cotización)"
            className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
          />
          <Textarea
            rows={2}
            value={rule.description || ''}
            onChange={(e) => {
              const next = [...rules];
              next[idx] = { ...next[idx], description: e.target.value };
              onChangeRules(next);
            }}
            placeholder="Cuándo aplicar (contexto para IA)"
            className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
          />
          {loadingEmpleados ? (
            <Spinner size="sm" />
          ) : (
            <Select
              sizing="sm"
              value={rule.user_id?.toString() || ''}
              onChange={(e) => {
                const userId = e.target.value ? Number(e.target.value) : undefined;
                const sel = empleados.find((emp: any) => emp.id === userId);
                const next = [...rules];
                next[idx] = {
                  ...next[idx],
                  user_id: userId,
                  user_name: sel ? `${sel.nombres} ${sel.apellidos || ''}`.trim() : '',
                };
                onChangeRules(next);
              }}
              className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
            >
              <option value="">Primer disponible</option>
              {empleados
                .filter((emp: any) => emp.acceso_activo !== false && emp.estado === 'activo')
                .map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombres} {emp.apellidos || ''}
                  </option>
                ))}
            </Select>
          )}
          <TextInput
            sizing="sm"
            value={rule.message || ''}
            onChange={(e) => {
              const next = [...rules];
              next[idx] = { ...next[idx], message: e.target.value };
              onChangeRules(next);
            }}
            placeholder="Mensaje personalizado (opcional)"
            className="bg-[#1A1A1A] border-[#2F2F2F] text-white"
          />
        </div>
      ))}
    </div>
  );
};

// ────────────────────────── helpers ──────────────────────────

function normalizeType(t: NodeType | string): NodeTypeId {
  if (t === 'question') return 'options';
  return t as NodeTypeId;
}

function iconForType(t: NodeTypeId): string {
  const found = PALETTE.find((p) => p.type === t);
  return found?.icon || 'solar:widget-bold';
}

export default FlowEditorJointJS;

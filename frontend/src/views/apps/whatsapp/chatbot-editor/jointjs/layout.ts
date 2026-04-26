/**
 * Auto-layout using elkjs (free, Eclipse layout kernel).
 * Returns a map of node-id → {x, y} so the caller can apply positions to the graph.
 */
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { dia } from '@joint/core';
import { Theme } from './theme';

const elk = new ELK();

export interface LayoutOptions {
  direction?: 'DOWN' | 'RIGHT';
  nodeSpacing?: number;
  layerSpacing?: number;
}

export async function autoLayout(
  graph: dia.Graph,
  opts: LayoutOptions = {},
): Promise<Map<string, { x: number; y: number }>> {
  const direction = opts.direction ?? 'DOWN';
  const nodeSpacing = opts.nodeSpacing ?? 40;
  const layerSpacing = opts.layerSpacing ?? 70;

  const elements = graph.getElements();
  const links = graph.getLinks();

  const elkNodes: ElkNode[] = elements.map((el) => ({
    id: String(el.id),
    width: el.size().width || Theme.NodeWidth,
    height: el.size().height || Theme.NodeHeight,
  }));

  const elkEdges = links
    .map((link) => {
      const source = (link.get('source') as any)?.id;
      const target = (link.get('target') as any)?.id;
      if (!source || !target) return null;
      return {
        id: String(link.id),
        sources: [String(source)],
        targets: [String(target)],
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const layoutInput: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const result = await elk.layout(layoutInput);

  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children || []) {
    if (typeof child.x === 'number' && typeof child.y === 'number') {
      positions.set(child.id, { x: child.x, y: child.y });
    }
  }
  return positions;
}

export function applyLayout(graph: dia.Graph, positions: Map<string, { x: number; y: number }>) {
  for (const el of graph.getElements()) {
    const pos = positions.get(String(el.id));
    if (pos) el.position(pos.x, pos.y);
  }
}

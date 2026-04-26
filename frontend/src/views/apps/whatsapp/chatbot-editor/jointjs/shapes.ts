/**
 * Custom JointJS shapes that replicate the visual design of
 * @clientIO/joint-demos marketing-automation using only @joint/core (free).
 */
import { dia, util, shapes } from '@joint/core';
import {
  Theme,
  nodeLabelAttributes,
  typeLabelAttributes,
  rectBodyAttributes,
  iconBackgroundAttributes,
  nodeTypePalette,
  nodeTypeIconPath,
  type NodeTypeId,
} from './theme';

/** SVG markup for a labeled node: body rect, icon bg, icon path, type label, label. */
const nodeMarkup = util.svg/* xml */`
  <rect @selector="body" />
  <rect @selector="iconBg" />
  <path @selector="icon" />
  <text @selector="typeLabel" />
  <text @selector="label" />
`;

/** SVG markup for a branch node (hexagonal shape like in the demo). */
const branchMarkup = util.svg/* xml */`
  <path @selector="body" />
  <rect @selector="iconBg" />
  <path @selector="icon" />
  <text @selector="typeLabel" />
  <text @selector="label" />
`;

/** SVG markup for edges: thick invisible hit area + visible line + arrow marker. */
const edgeMarkup = util.svg/* xml */`
  <path @selector="wrapper" stroke="transparent" fill="none" cursor="pointer" pointer-events="stroke" stroke-linejoin="round" stroke-linecap="round" />
  <path @selector="line" fill="none" stroke-linejoin="round" pointer-events="none" />
`;

const edgeLabelMarkup = util.svg/* xml */`
  <rect @selector="labelBody" />
  <text @selector="labelText" />
`;

export interface ChatbotNodeAttrs extends dia.Element.Attributes {
  nodeType?: NodeTypeId;
  backendId?: number;
  config?: Record<string, any>;
}

export const ChatbotNode = shapes.standard.Rectangle.define('chatbot.Node', {
  size: { width: Theme.NodeWidth, height: Theme.NodeHeight },
  attrs: {
    body: rectBodyAttributes,
    iconBg: iconBackgroundAttributes,
    icon: {
      x: Theme.NodeHorizontalPadding + (Theme.IconBackgroundSize - Theme.IconSize) / 2,
      y: (Theme.NodeHeight - Theme.IconSize) / 2,
      width: Theme.IconSize,
      height: Theme.IconSize,
      fill: '#1F2433',
      stroke: 'none',
      // transform the 20x20 icon paths into the target slot
      transform: `translate(${Theme.NodeHorizontalPadding + (Theme.IconBackgroundSize - Theme.IconSize) / 2}, ${(Theme.NodeHeight - Theme.IconSize) / 2})`,
      d: nodeTypeIconPath.message,
      // reset x/y since we use transform
    },
    typeLabel: typeLabelAttributes,
    label: nodeLabelAttributes,
  },
}, {
  markup: nodeMarkup,
  /** Apply node-type-specific styling (icon path, tint, type label text). */
  applyType(nodeType: NodeTypeId, label: string, customTypeLabel?: string) {
    const palette = nodeTypePalette[nodeType] ?? nodeTypePalette.message;
    this.set('nodeType', nodeType);
    this.attr({
      iconBg: {
        fill: palette.tint,
        stroke: palette.accent + '33',
      },
      icon: {
        fill: palette.accent,
        d: nodeTypeIconPath[nodeType] ?? nodeTypeIconPath.message,
      },
      typeLabel: {
        text: customTypeLabel ?? palette.typeLabel,
        fill: Theme.NodeTypeLabelColor,
      },
      label: {
        text: truncate(label || palette.typeLabel, 28),
        fill: Theme.NodeLabelColor,
      },
    });
  }
});

/**
 * Hexagonal "Branch" shape -- condition/options/question nodes get this look,
 * matching the demo's Branch model (body is a hexagon with a notch on both sides).
 */
export const ChatbotBranchNode = shapes.standard.Path.define('chatbot.BranchNode', {
  size: { width: Theme.NodeWidth, height: Theme.NodeHeight },
  attrs: {
    body: {
      d: hexagonPath(Theme.NodeWidth, Theme.NodeHeight, 20),
      fill: Theme.NodeBackgroundColor,
      stroke: Theme.NodeBorderColor,
      strokeWidth: Theme.NodeBorderWidth,
      cursor: 'move',
    },
    iconBg: {
      x: Theme.NodeHorizontalPadding + 10,
      y: (Theme.NodeHeight - Theme.IconBackgroundSize) / 2,
      width: Theme.IconBackgroundSize,
      height: Theme.IconBackgroundSize,
      rx: Theme.IconBackgroundRadius,
      ry: Theme.IconBackgroundRadius,
      fill: '#FFFBEB',
      stroke: '#FFE388',
      strokeWidth: 1,
    },
    icon: {
      fill: '#D97706',
      d: nodeTypeIconPath.condition,
      transform: `translate(${Theme.NodeHorizontalPadding + 10 + (Theme.IconBackgroundSize - Theme.IconSize) / 2}, ${(Theme.NodeHeight - Theme.IconSize) / 2})`,
    },
    typeLabel: {
      ...typeLabelAttributes,
      x: Theme.NodeHorizontalPadding + 10 + Theme.IconBackgroundSize + Theme.IconLabelSpacing,
    },
    label: {
      ...nodeLabelAttributes,
      x: Theme.NodeHorizontalPadding + 10 + Theme.IconBackgroundSize + Theme.IconLabelSpacing,
    },
  },
}, {
  markup: branchMarkup,
  /** Apply node-type-specific styling (icon path, tint, type label text). */
  applyType(nodeType: NodeTypeId, label: string, customTypeLabel?: string) {
    const palette = nodeTypePalette[nodeType] ?? nodeTypePalette.condition;
    this.set('nodeType', nodeType);
    this.attr({
      iconBg: {
        fill: palette.tint,
        stroke: palette.accent + '33',
      },
      icon: {
        fill: palette.accent,
        d: nodeTypeIconPath[nodeType] ?? nodeTypeIconPath.condition,
      },
      typeLabel: { text: customTypeLabel ?? palette.typeLabel, fill: Theme.NodeTypeLabelColor },
      label: { text: truncate(label || palette.typeLabel, 26), fill: Theme.NodeLabelColor },
    });
  }
});

// Register so graph.fromJSON / links that reference type: 'chatbot.Node' work.
// We add them into the shapes namespace so dia.Paper picks them up.
(shapes as any).chatbot = { Node: ChatbotNode, BranchNode: ChatbotBranchNode };

/**
 * Hexagon path with chevron notches on left/right — matches the demo's Branch body.
 * Top/bottom corners are flat, left/right are pointed outward. Rounded-rect look
 * kept simple here (no outer arcs) to render correctly with @joint/core.
 */
function hexagonPath(w: number, h: number, slope: number): string {
  return [
    `M ${slope},0`,
    `L ${w - slope},0`,
    `L ${w},${h / 2}`,
    `L ${w - slope},${h}`,
    `L ${slope},${h}`,
    `L 0,${h / 2}`,
    'Z',
  ].join(' ');
}

export class ChatbotEdge extends shapes.standard.Link {
  preinitialize(): void {
    this.markup = edgeMarkup;
  }
  defaults(): Partial<dia.Link.Attributes> {
    return util.defaultsDeep(
      {
        type: 'chatbot.Edge',
        defaultLabel: {
          markup: edgeLabelMarkup,
          attrs: {
            labelText: {
              fontFamily: Theme.FontFamily,
              fontSize: 12,
              fill: Theme.EdgeLabelColor,
              textAnchor: 'middle',
              textVerticalAnchor: 'middle',
              pointerEvents: 'none',
            },
            labelBody: {
              ref: 'labelText',
              fill: Theme.EdgeLabelBackgroundColor,
              stroke: Theme.EdgeLabelBorderColor,
              rx: 6,
              ry: 6,
              strokeWidth: 1,
              x: `calc(x - ${Theme.EdgeLabelHorizontalPadding})`,
              y: `calc(y - ${Theme.EdgeLabelVerticalPadding})`,
              width: `calc(w + ${2 * Theme.EdgeLabelHorizontalPadding})`,
              height: `calc(h + ${2 * Theme.EdgeLabelVerticalPadding})`,
            },
          },
        },
        attrs: {
          line: {
            connection: true,
            stroke: Theme.EdgeColor,
            strokeWidth: Theme.EdgeWidth,
            targetMarker: {
              type: 'path',
              d: 'M 8 -4 0 0 8 4 Z',
              fill: Theme.EdgeColor,
              stroke: 'none',
            },
          },
          wrapper: {
            connection: true,
            strokeWidth: Theme.EdgeWidth + 10,
          },
        },
      },
      super.defaults,
    ) as any;
  }
}

(shapes as any).chatbot = { ...(shapes as any).chatbot, Edge: ChatbotEdge };

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

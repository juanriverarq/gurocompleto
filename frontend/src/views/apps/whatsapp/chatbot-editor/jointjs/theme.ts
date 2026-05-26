/**
 * Theme adapted from @clientIO/joint-demos marketing-automation.
 * All values match the original demo pixel-for-pixel.
 */
export const Theme = {
  // Dark canvas + grid
  BackgroundColor: '#0A0A0A',
  GridColor: '#1F1F1F',
  ConnectionTargetColor: '#60A5FA',
  AvailableConnectionTargetColor: '#FBBF24',

  // Edges
  EdgeColor: '#3F3F46',
  EdgeLabelColor: '#E5E7EB',
  EdgeLabelBackgroundColor: '#1F1F1F',
  EdgeLabelBorderColor: '#3F3F46',
  EdgeLabelHorizontalPadding: 10,
  EdgeLabelVerticalPadding: 6,
  EdgePreviewColor: '#818CF8',
  EdgeWidth: 2,

  FontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',

  // Icon slot on the node
  IconBackgroundBorderColor: '#2A2A2A',
  IconBackgroundColor: '#1A1A1A',
  IconBackgroundBorderWidth: 1,
  IconBackgroundRadius: 10,
  IconBackgroundSize: 32,
  IconLabelSpacing: 12,
  IconSize: 20,

  // Port colors
  PortColor: '#60A5FA',
  PortBorderColor: '#3B82F6',
  PortHoverColor: '#818CF8',

  // Node body
  NodeBackgroundColor: '#161616',
  NodeBorderColor: '#2A2A2A',
  NodeBorderRadius: 12,
  NodeBorderWidth: 1,
  NodeHeight: 62,
  NodeHorizontalPadding: 12,
  NodeLabelColor: '#F3F4F6',
  NodeTypeLabelColor: '#9CA3AF',
  NodeVerticalPadding: 12,
  NodeWidth: 252,

  SelectionColor: '#818CF8',

  TextVerticalMargin: 3,

  // UI shell — used by React components (not JointJS shapes)
  ShellBackground: '#0A0A0A',
  ShellSurface: '#111111',
  ShellSurfaceElevated: '#161616',
  ShellBorder: '#1F1F1F',
  ShellBorderSubtle: '#2A2A2A',
  ShellText: '#F3F4F6',
  ShellTextMuted: '#9CA3AF',
  ShellAccent: '#818CF8',
};

export const nodeLabelAttributes = {
  fontSize: 13,
  fontWeight: 500,
  fontFamily: Theme.FontFamily,
  textVerticalAnchor: 'top',
  textAnchor: 'start',
  lineHeight: '1em',
  x: Theme.NodeHorizontalPadding + Theme.IconBackgroundSize + Theme.IconLabelSpacing,
  y: Theme.NodeHeight / 2 + Theme.TextVerticalMargin,
  fill: Theme.NodeLabelColor,
};

export const typeLabelAttributes = {
  fontSize: 12,
  fontWeight: 400,
  fontFamily: Theme.FontFamily,
  textVerticalAnchor: 'bottom',
  textAnchor: 'start',
  lineHeight: '1em',
  x: Theme.NodeHorizontalPadding + Theme.IconBackgroundSize + Theme.IconLabelSpacing,
  y: Theme.NodeHeight / 2 - Theme.TextVerticalMargin,
  fill: Theme.NodeTypeLabelColor,
};

export const rectBodyAttributes = {
  width: 'calc(w)',
  height: 'calc(h)',
  fill: Theme.NodeBackgroundColor,
  stroke: Theme.NodeBorderColor,
  strokeWidth: Theme.NodeBorderWidth,
  rx: Theme.NodeBorderRadius,
  ry: Theme.NodeBorderRadius,
  cursor: 'move',
};

export const iconBackgroundAttributes = {
  x: Theme.NodeHorizontalPadding,
  y: (Theme.NodeHeight - Theme.IconBackgroundSize) / 2,
  width: Theme.IconBackgroundSize,
  height: Theme.IconBackgroundSize,
  rx: Theme.IconBackgroundRadius,
  ry: Theme.IconBackgroundRadius,
  fill: Theme.IconBackgroundColor,
  stroke: Theme.IconBackgroundBorderColor,
  strokeWidth: Theme.IconBackgroundBorderWidth,
};

export type NodeTypeId =
  | 'start'
  | 'message'
  | 'question'
  | 'options'
  | 'input'
  | 'condition'
  | 'action'
  | 'ai_response'
  | 'transfer'
  | 'delay'
  | 'end'
  | 'policy_lookup'
  | 'add_tag'
  | 'remove_tag'
  | 'media'
  | 'webhook'
  | 'interactive'
  | 'set_variable'
  | 'consent';

// Icon background tint per node type — dark-mode friendly (accent on dark bg)
// For dark mode we use a muted version of the accent as tint so the colored
// icon reads well without the "pastel card" look of the light theme.
export const nodeTypePalette: Record<NodeTypeId, { tint: string; accent: string; minimap: string; typeLabel: string }> = {
  start:         { tint: '#052E24', accent: '#34D399', minimap: '#34D399', typeLabel: 'Inicio' },
  message:       { tint: '#0B2540', accent: '#60A5FA', minimap: '#60A5FA', typeLabel: 'Mensaje' },
  question:      { tint: '#2A0F4D', accent: '#C084FC', minimap: '#C084FC', typeLabel: 'Pregunta' },
  options:       { tint: '#2A0F4D', accent: '#C084FC', minimap: '#C084FC', typeLabel: 'Opciones' },
  input:         { tint: '#062A33', accent: '#22D3EE', minimap: '#22D3EE', typeLabel: 'Entrada' },
  condition:     { tint: '#3D2A06', accent: '#FBBF24', minimap: '#FBBF24', typeLabel: 'Condición' },
  action:        { tint: '#3B2F06', accent: '#FACC15', minimap: '#FACC15', typeLabel: 'Acción' },
  ai_response:   { tint: '#3B0D2A', accent: '#F472B6', minimap: '#F472B6', typeLabel: 'IA' },
  transfer:      { tint: '#3B0E0E', accent: '#F87171', minimap: '#F87171', typeLabel: 'Transferir' },
  delay:         { tint: '#241640', accent: '#A78BFA', minimap: '#A78BFA', typeLabel: 'Espera' },
  end:           { tint: '#1F2937', accent: '#94A3B8', minimap: '#94A3B8', typeLabel: 'Fin' },
  policy_lookup: { tint: '#042F2E', accent: '#2DD4BF', minimap: '#2DD4BF', typeLabel: 'Consultar póliza' },
  add_tag:       { tint: '#052E24', accent: '#10B981', minimap: '#10B981', typeLabel: 'Añadir etiqueta' },
  remove_tag:    { tint: '#3B0D17', accent: '#FB7185', minimap: '#FB7185', typeLabel: 'Quitar etiqueta' },
  media:         { tint: '#3B1A06', accent: '#FB923C', minimap: '#FB923C', typeLabel: 'Multimedia' },
  webhook:       { tint: '#062A40', accent: '#38BDF8', minimap: '#38BDF8', typeLabel: 'Webhook' },
  interactive:   { tint: '#1E1B4B', accent: '#818CF8', minimap: '#818CF8', typeLabel: 'Interactivo' },
  set_variable:  { tint: '#1C1917', accent: '#A8A29E', minimap: '#A8A29E', typeLabel: 'Variable' },
  consent:       { tint: '#052033', accent: '#38BDF8', minimap: '#38BDF8', typeLabel: 'Consentimiento' },
};

// SVG icon paths (20x20 viewBox) — extracted/simplified so JointJS can render them without external assets
export const nodeTypeIconPath: Record<NodeTypeId, string> = {
  start:         'M6 4l10 6-10 6V4z',
  message:       'M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8l-4 4v-4H5a2 2 0 0 1-2-2V5z',
  question:      'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3.2c1.9 0 3.4 1.3 3.4 3.1 0 1.3-.7 2-1.8 2.6-.6.3-.9.6-1 1v.5h-1.3v-.6c.1-.9.7-1.5 1.4-1.9.7-.4 1.1-.8 1.1-1.6 0-1-.8-1.6-1.8-1.6-1 0-1.8.6-1.8 1.6H6.6c0-1.8 1.5-3.1 3.4-3.1zm-.7 8.9h1.3V16h-1.3v-1.9z',
  options:       'M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z',
  input:         'M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm3 4h8v1H6V9z',
  condition:     'M10 1l9 18H1L10 1zm0 6v5h1V7h-1zm0 6v1h1v-1h-1z',
  action:        'M11 2l-7 9h4l-1 7 7-9h-4l1-7z',
  ai_response:   'M10 2l1.5 4L16 8l-4.5 2L10 14l-1.5-4L4 8l4.5-2L10 2zm6 9l.8 2.2L19 14l-2.2.8L16 17l-.8-2.2L13 14l2.2-.8L16 11z',
  transfer:      'M2 10h12m0 0l-4-4m4 4l-4 4',
  delay:         'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2v6l4 2',
  end:           'M5 5h10v10H5V5z',
  policy_lookup: 'M10 2L3 5v5c0 4 3 7 7 8 4-1 7-4 7-8V5l-7-3zm-1 10l-2-2 1-1 1 1 3-3 1 1-4 4z',
  add_tag:       'M10 2l8 3v6l-8 8-8-8V5l8-3zm0 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  remove_tag:    'M10 2l8 3v6l-8 8-8-8V5l8-3zm-3 6l2 2-2 2 1 1 2-2 2 2 1-1-2-2 2-2-1-1-2 2-2-2-1 1z',
  media:         'M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm5 2v6l5-3-5-3z',
  webhook:       'M6 2a4 4 0 0 1 8 0c0 1.7-1.1 3.1-2.5 3.7l2 4.3H18v4a4 4 0 1 1-4-4h4l-3-6-1 2-2-4a2 2 0 1 0 0 0z',
  interactive:   'M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z',
  set_variable:  'M4 4h6v2H4V4zm0 5h12v2H4V9zm0 5h8v2H4v-2z',
  consent:       'M9 12l2 2 4-4m-7 8a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
};

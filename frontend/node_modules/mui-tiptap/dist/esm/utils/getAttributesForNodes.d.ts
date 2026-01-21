import type { NodeType } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
/**
 * Get the attributes of all currently selected nodes of the given type or
 * name.
 *
 * Returns an array of Records, with an entry for each matching node that is
 * currently selected.
 *
 * Based directly on Tiptap's getNodeAttributes
 * (https://github.com/ueberdosis/tiptap/blob/f387ad3dd4c2b30eaea33fb0ba0b42e0cd39263b/packages/core/src/helpers/getNodeAttributes.ts),
 * but returns results for each of the matching nodes, rather than just the
 * first. See related: https://github.com/ueberdosis/tiptap/issues/3481
 */
export declare function getAttributesForNodes(state: EditorState, typeOrName: string | NodeType): Record<string, any>[];

import type { Editor } from "@tiptap/core";
export type UseDebouncedFocusOptions = {
    editor: Editor | null;
    /**
     * The debounce wait timeout in ms for updating focused state. By default 250.
     */
    wait?: number;
};
/**
 * A hook for getting the Tiptap editor focused state, but debounced to prevent
 * "flashing" for brief blur/refocus moments, like when interacting with the
 * menu bar buttons.
 *
 * This is useful for showing the focus state visually, as with the `focused`
 * prop of <FieldContainer />.
 */
export default function useDebouncedFocus({ editor, wait, }: UseDebouncedFocusOptions): boolean;

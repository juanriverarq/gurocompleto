import type { Editor, EditorEvents } from "@tiptap/core";
export type UseEditorOnEditableUpdateOptions = {
    editor: Editor | null;
    /**
     * The function that will be called when editor.isEditable is changed. Set to
     * null or undefined to turn off the listener.
     */
    callback?: ((props: EditorEvents["update"]) => void) | null | undefined;
};
/**
 * A hook for listening to changes in the Tiptap editor isEditable state, via
 * "update" event.
 *
 * This can be useful inside of ReactNodeViews that depend on editor isEditable
 * state. As described here https://github.com/ueberdosis/tiptap/issues/3775,
 * updates to editor isEditable do not trigger re-rendering of node views. Even
 * editor state changes external to a given ReactNodeView component will not
 * trigger re-render (which is probably a good thing most of the time, in terms
 * of performance). As such, this hook can listen for editor.isEditable changes
 * and can be used to force a re-render, update state, etc.
 */
export default function useEditorOnEditableUpdate({ editor, callback, }: UseEditorOnEditableUpdateOptions): void;

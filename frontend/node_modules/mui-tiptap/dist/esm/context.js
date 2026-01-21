import { createContext, useContext } from "react";
export const RichTextEditorContext = createContext(undefined);
export function useRichTextEditorContext() {
    const editor = useContext(RichTextEditorContext);
    if (editor === undefined) {
        throw new Error("Tiptap editor not found in component context. Be sure to use <RichTextEditorProvider editor={editor} />!");
    }
    return editor;
}

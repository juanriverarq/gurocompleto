"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRichTextEditorContext = exports.RichTextEditorContext = void 0;
const react_1 = require("react");
exports.RichTextEditorContext = (0, react_1.createContext)(undefined);
function useRichTextEditorContext() {
    const editor = (0, react_1.useContext)(exports.RichTextEditorContext);
    if (editor === undefined) {
        throw new Error("Tiptap editor not found in component context. Be sure to use <RichTextEditorProvider editor={editor} />!");
    }
    return editor;
}
exports.useRichTextEditorContext = useRichTextEditorContext;

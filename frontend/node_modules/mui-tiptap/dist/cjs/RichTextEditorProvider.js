"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("./context");
/**
 * Makes the Tiptap `editor` available to any nested components, via the
 * `useRichTextEditorContext()` hook so that the `editor` does not need to be
 * manually passed in at every level.
 *
 * Required as a parent for most mui-tiptap components besides the all-in-one
 * `RichTextEditor` and `RichTextReadOnly`.
 */
function RichTextEditorProvider({ editor, children, }) {
    return ((0, jsx_runtime_1.jsx)(context_1.RichTextEditorContext.Provider, { value: editor, children: children }));
}
exports.default = RichTextEditorProvider;

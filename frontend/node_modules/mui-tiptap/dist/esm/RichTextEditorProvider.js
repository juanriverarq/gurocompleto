import { jsx as _jsx } from "react/jsx-runtime";
import { RichTextEditorContext } from "./context";
/**
 * Makes the Tiptap `editor` available to any nested components, via the
 * `useRichTextEditorContext()` hook so that the `editor` does not need to be
 * manually passed in at every level.
 *
 * Required as a parent for most mui-tiptap components besides the all-in-one
 * `RichTextEditor` and `RichTextReadOnly`.
 */
export default function RichTextEditorProvider({ editor, children, }) {
    return (_jsx(RichTextEditorContext.Provider, { value: editor, children: children }));
}

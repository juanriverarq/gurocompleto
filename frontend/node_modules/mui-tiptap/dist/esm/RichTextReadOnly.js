import { jsx as _jsx } from "react/jsx-runtime";
import { useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import RichTextContent from "./RichTextContent";
import RichTextEditorProvider from "./RichTextEditorProvider";
function RichTextReadOnlyInternal(props) {
    const editor = useEditor({
        ...props,
        editable: false,
    });
    // Update content if/when it changes
    const previousContent = useRef(props.content);
    useEffect(() => {
        if (!editor ||
            editor.isDestroyed ||
            props.content === undefined ||
            props.content === previousContent.current) {
            return;
        }
        // We use queueMicrotask to avoid any flushSync console errors as
        // mentioned here
        // https://github.com/ueberdosis/tiptap/issues/3764#issuecomment-1546854730
        queueMicrotask(() => {
            // Validate that props.content isn't undefined again to appease TS
            if (props.content !== undefined) {
                editor.commands.setContent(props.content);
            }
        });
    }, [props.content, editor]);
    useEffect(() => {
        previousContent.current = props.content;
    }, [props.content]);
    return (_jsx(RichTextEditorProvider, { editor: editor, children: _jsx(RichTextContent, {}) }));
}
/**
 * An all-in-one component to directly render read-only Tiptap editor content.
 *
 * When to use this component:
 * - You just want to render editor HTML/JSON content directly, without any
 *   outlined field styling, menu bar, extra setup, etc.
 * - You want a convenient way to render content that re-renders as the
 *   `content` prop changes.
 *
 * Though RichtextEditor (or useEditor, RichTextEditorProvider, and
 * RichTextContent) can be used as read-only via the editor's `editable` prop,
 * this is a simpler and more efficient version that only renders content and
 * nothing more (e.g., skips instantiating the editor at all if there's no
 * content to display, and does not contain additional rendering logic related
 * to controls, outlined field UI state, etc.).
 *
 * Example:
 * <RichTextReadOnly content="<p>Hello world</p>" extensions={[StarterKit]} />
 */
export default function RichTextReadOnly(props) {
    if (!props.content) {
        // Don't bother instantiating an editor at all (for performance) if we have
        // no content
        return null;
    }
    return _jsx(RichTextReadOnlyInternal, { ...props });
}

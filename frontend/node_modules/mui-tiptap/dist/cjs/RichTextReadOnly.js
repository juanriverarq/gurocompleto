"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("@tiptap/react");
const react_2 = require("react");
const RichTextContent_1 = __importDefault(require("./RichTextContent"));
const RichTextEditorProvider_1 = __importDefault(require("./RichTextEditorProvider"));
function RichTextReadOnlyInternal(props) {
    const editor = (0, react_1.useEditor)(Object.assign(Object.assign({}, props), { editable: false }));
    // Update content if/when it changes
    const previousContent = (0, react_2.useRef)(props.content);
    (0, react_2.useEffect)(() => {
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
    (0, react_2.useEffect)(() => {
        previousContent.current = props.content;
    }, [props.content]);
    return ((0, jsx_runtime_1.jsx)(RichTextEditorProvider_1.default, { editor: editor, children: (0, jsx_runtime_1.jsx)(RichTextContent_1.default, {}) }));
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
function RichTextReadOnly(props) {
    if (!props.content) {
        // Don't bother instantiating an editor at all (for performance) if we have
        // no content
        return null;
    }
    return (0, jsx_runtime_1.jsx)(RichTextReadOnlyInternal, Object.assign({}, props));
}
exports.default = RichTextReadOnly;

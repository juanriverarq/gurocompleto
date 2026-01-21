import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-highlight" />
import { useRichTextEditorContext } from "../context";
import { FormatInkHighlighter } from "../icons";
import MenuButton from "./MenuButton";
/**
 * Control for a user to toggle text highlighting with the
 * @tiptap/extension-highlight, just using the default `<mark>`
 * background-color.
 *
 * This is typically useful when using the default Highlight extension
 * configuration (*not* configuring with `mulitcolor: true`). See
 * MenuButtonHighlightColor for a multicolor-oriented color-selection highlight
 * control.
 */
export default function MenuButtonHighlightToggle({ ...menuButtonProps }) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { IconComponent: FormatInkHighlighter, tooltipLabel: "Highlight", tooltipShortcutKeys: ["mod", "Shift", "H"], selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive("highlight")) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().toggleHighlight(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().toggleHighlight().run(), ...menuButtonProps }));
}

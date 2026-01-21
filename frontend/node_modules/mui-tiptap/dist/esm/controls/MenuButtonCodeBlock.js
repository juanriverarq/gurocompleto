import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-code-block" />
import { useRichTextEditorContext } from "../context";
import { CodeBlock } from "../icons";
import MenuButton from "./MenuButton";
export default function MenuButtonCodeBlock(props) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Code block", tooltipShortcutKeys: ["mod", "Alt", "C"], IconComponent: CodeBlock, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive("codeBlock")) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().toggleCodeBlock(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().toggleCodeBlock().run(), ...props }));
}

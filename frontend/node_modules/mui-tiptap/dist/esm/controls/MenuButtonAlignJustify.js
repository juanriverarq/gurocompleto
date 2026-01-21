import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-text-align" />
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonAlignJustify(props) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Justify", tooltipShortcutKeys: ["mod", "Shift", "J"], IconComponent: FormatAlignJustifyIcon, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive({ textAlign: "justify" })) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setTextAlign("justify"), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setTextAlign("justify").run(), ...props }));
}

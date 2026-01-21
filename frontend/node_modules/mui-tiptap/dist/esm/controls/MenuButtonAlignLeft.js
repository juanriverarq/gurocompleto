import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-text-align" />
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonAlignLeft(props) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Left align", tooltipShortcutKeys: ["mod", "Shift", "L"], IconComponent: FormatAlignLeftIcon, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive({ textAlign: "left" })) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setTextAlign("left"), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setTextAlign("left").run(), ...props }));
}

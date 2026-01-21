import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-text-align" />
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonAlignCenter(props) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Center align", tooltipShortcutKeys: ["mod", "Shift", "E"], IconComponent: FormatAlignCenterIcon, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive({ textAlign: "center" })) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setTextAlign("center"), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setTextAlign("center").run(), ...props }));
}

import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-text-align" />
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonAlignRight(props) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Right align", tooltipShortcutKeys: ["mod", "Shift", "R"], IconComponent: FormatAlignRightIcon, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive({ textAlign: "right" })) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setTextAlign("right"), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setTextAlign("right").run(), ...props }));
}

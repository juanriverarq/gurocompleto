import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-underline" />
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonUnderline(props) {
    var _a;
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Underline", tooltipShortcutKeys: ["mod", "U"], IconComponent: FormatUnderlinedIcon, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive("underline")) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().toggleUnderline(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().toggleUnderline().run(), ...props }));
}

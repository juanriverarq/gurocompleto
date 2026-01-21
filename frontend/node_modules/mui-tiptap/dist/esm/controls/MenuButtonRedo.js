import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-history" />
import RedoIcon from "@mui/icons-material/Redo";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonRedo(props) {
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Redo", tooltipShortcutKeys: ["mod", "Shift", "Z"], IconComponent: RedoIcon, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().redo(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().redo().run(), ...props }));
}

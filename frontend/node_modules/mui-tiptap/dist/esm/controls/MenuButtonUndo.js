import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-history" />
import UndoIcon from "@mui/icons-material/Undo";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonUndo(props) {
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Undo", tooltipShortcutKeys: ["mod", "Z"], IconComponent: UndoIcon, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().undo(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().undo().run(), ...props }));
}

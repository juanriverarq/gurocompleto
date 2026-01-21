import { jsx as _jsx } from "react/jsx-runtime";
/// <reference types="@tiptap/extension-horizontal-rule" />
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { useRichTextEditorContext } from "../context";
import MenuButton from "./MenuButton";
export default function MenuButtonHorizontalRule(props) {
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Insert horizontal line", IconComponent: HorizontalRuleIcon, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setHorizontalRule(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setHorizontalRule().run(), ...props }));
}

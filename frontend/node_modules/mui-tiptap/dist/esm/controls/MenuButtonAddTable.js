import { jsx as _jsx } from "react/jsx-runtime";
import { useRichTextEditorContext } from "../context";
import { Table } from "../icons";
import MenuButton from "./MenuButton";
export default function MenuButtonAddTable(props) {
    const editor = useRichTextEditorContext();
    return (_jsx(MenuButton, { tooltipLabel: "Insert table", IconComponent: Table, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().insertTable(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), ...props }));
}

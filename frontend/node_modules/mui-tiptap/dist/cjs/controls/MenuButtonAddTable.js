"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../context");
const icons_1 = require("../icons");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonAddTable(props) {
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Insert table", IconComponent: icons_1.Table, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().insertTable(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }, props)));
}
exports.default = MenuButtonAddTable;

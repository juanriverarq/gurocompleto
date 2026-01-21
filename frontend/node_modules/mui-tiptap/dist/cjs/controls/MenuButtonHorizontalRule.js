"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-horizontal-rule" />
const HorizontalRule_1 = __importDefault(require("@mui/icons-material/HorizontalRule"));
const context_1 = require("../context");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonHorizontalRule(props) {
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Insert horizontal line", IconComponent: HorizontalRule_1.default, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setHorizontalRule(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setHorizontalRule().run() }, props)));
}
exports.default = MenuButtonHorizontalRule;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-text-align" />
const FormatAlignLeft_1 = __importDefault(require("@mui/icons-material/FormatAlignLeft"));
const context_1 = require("../context");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonAlignLeft(props) {
    var _a;
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Left align", tooltipShortcutKeys: ["mod", "Shift", "L"], IconComponent: FormatAlignLeft_1.default, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive({ textAlign: "left" })) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setTextAlign("left"), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setTextAlign("left").run() }, props)));
}
exports.default = MenuButtonAlignLeft;

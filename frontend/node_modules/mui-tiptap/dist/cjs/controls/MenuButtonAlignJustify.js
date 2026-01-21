"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-text-align" />
const FormatAlignJustify_1 = __importDefault(require("@mui/icons-material/FormatAlignJustify"));
const context_1 = require("../context");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonAlignJustify(props) {
    var _a;
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Justify", tooltipShortcutKeys: ["mod", "Shift", "J"], IconComponent: FormatAlignJustify_1.default, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive({ textAlign: "justify" })) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setTextAlign("justify"), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().setTextAlign("justify").run() }, props)));
}
exports.default = MenuButtonAlignJustify;

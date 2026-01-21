"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-underline" />
const FormatUnderlined_1 = __importDefault(require("@mui/icons-material/FormatUnderlined"));
const context_1 = require("../context");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonUnderline(props) {
    var _a;
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Underline", tooltipShortcutKeys: ["mod", "U"], IconComponent: FormatUnderlined_1.default, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive("underline")) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().toggleUnderline(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().toggleUnderline().run() }, props)));
}
exports.default = MenuButtonUnderline;

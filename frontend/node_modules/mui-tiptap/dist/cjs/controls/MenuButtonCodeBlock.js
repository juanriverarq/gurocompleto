"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-code-block" />
const context_1 = require("../context");
const icons_1 = require("../icons");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonCodeBlock(props) {
    var _a;
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Code block", tooltipShortcutKeys: ["mod", "Alt", "C"], IconComponent: icons_1.CodeBlock, selected: (_a = editor === null || editor === void 0 ? void 0 : editor.isActive("codeBlock")) !== null && _a !== void 0 ? _a : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().toggleCodeBlock(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().toggleCodeBlock().run() }, props)));
}
exports.default = MenuButtonCodeBlock;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-history" />
const Redo_1 = __importDefault(require("@mui/icons-material/Redo"));
const context_1 = require("../context");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonRedo(props) {
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Redo", tooltipShortcutKeys: ["mod", "Shift", "Z"], IconComponent: Redo_1.default, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().redo(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().redo().run() }, props)));
}
exports.default = MenuButtonRedo;

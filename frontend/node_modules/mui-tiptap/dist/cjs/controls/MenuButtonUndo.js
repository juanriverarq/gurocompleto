"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-history" />
const Undo_1 = __importDefault(require("@mui/icons-material/Undo"));
const context_1 = require("../context");
const MenuButton_1 = __importDefault(require("./MenuButton"));
function MenuButtonUndo(props) {
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ tooltipLabel: "Undo", tooltipShortcutKeys: ["mod", "Z"], IconComponent: Undo_1.default, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().undo(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().undo().run() }, props)));
}
exports.default = MenuButtonUndo;

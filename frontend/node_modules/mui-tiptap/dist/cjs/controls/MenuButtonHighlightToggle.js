"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-highlight" />
const context_1 = require("../context");
const icons_1 = require("../icons");
const MenuButton_1 = __importDefault(require("./MenuButton"));
/**
 * Control for a user to toggle text highlighting with the
 * @tiptap/extension-highlight, just using the default `<mark>`
 * background-color.
 *
 * This is typically useful when using the default Highlight extension
 * configuration (*not* configuring with `mulitcolor: true`). See
 * MenuButtonHighlightColor for a multicolor-oriented color-selection highlight
 * control.
 */
function MenuButtonHighlightToggle(_a) {
    var _b;
    var menuButtonProps = __rest(_a, []);
    const editor = (0, context_1.useRichTextEditorContext)();
    return ((0, jsx_runtime_1.jsx)(MenuButton_1.default, Object.assign({ IconComponent: icons_1.FormatInkHighlighter, tooltipLabel: "Highlight", tooltipShortcutKeys: ["mod", "Shift", "H"], selected: (_b = editor === null || editor === void 0 ? void 0 : editor.isActive("highlight")) !== null && _b !== void 0 ? _b : false, disabled: !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().toggleHighlight(), onClick: () => editor === null || editor === void 0 ? void 0 : editor.chain().focus().toggleHighlight().run() }, menuButtonProps)));
}
exports.default = MenuButtonHighlightToggle;

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
exports.MENU_BUTTON_FONT_SIZE_DEFAULT = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const mui_1 = require("tss-react/mui");
const MenuButtonTooltip_1 = __importDefault(require("./MenuButtonTooltip"));
exports.MENU_BUTTON_FONT_SIZE_DEFAULT = "1.25rem";
const useStyles = (0, mui_1.makeStyles)({ name: { MenuButton } })({
    root: {
        // Use && for additional specificity, since MUI's conditional "disabled"
        // styles also set the border
        [`&& .${material_1.toggleButtonClasses.root}`]: {
            border: "none",
            padding: 5,
        },
    },
    menuButtonIcon: {
        fontSize: exports.MENU_BUTTON_FONT_SIZE_DEFAULT,
    },
});
/**
 * A general-purpose base component for showing an editor control for use in a
 * menu.
 */
function MenuButton(_a) {
    var { tooltipLabel, tooltipShortcutKeys, IconComponent, buttonRef, children } = _a, toggleButtonProps = __rest(_a, ["tooltipLabel", "tooltipShortcutKeys", "IconComponent", "buttonRef", "children"]);
    const { classes } = useStyles();
    return ((0, jsx_runtime_1.jsx)("span", { className: classes.root, children: (0, jsx_runtime_1.jsx)(MenuButtonTooltip_1.default, { label: tooltipLabel, shortcutKeys: tooltipShortcutKeys, children: (0, jsx_runtime_1.jsx)(material_1.ToggleButton, Object.assign({ ref: buttonRef, size: "small", value: tooltipLabel }, toggleButtonProps, { children: children !== null && children !== void 0 ? children : (IconComponent && ((0, jsx_runtime_1.jsx)(IconComponent, { className: classes.menuButtonIcon }))) })) }) }));
}
exports.default = MenuButton;

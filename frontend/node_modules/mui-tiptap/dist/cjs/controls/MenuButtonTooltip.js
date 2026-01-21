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
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const mui_1 = require("tss-react/mui");
const platform_1 = require("../utils/platform");
const useStyles = (0, mui_1.makeStyles)({ name: { MenuButtonTooltip } })((theme) => ({
    titleContainer: {
        textAlign: "center",
    },
    label: {
        fontSize: theme.typography.pxToRem(13),
    },
    shortcutKey: {
        fontSize: theme.typography.pxToRem(12),
        border: `1px solid ${(0, material_1.alpha)(theme.palette.text.secondary, 0.2)}`,
        backgroundColor: (0, material_1.alpha)(theme.palette.background.paper, 0.3),
        height: "19px",
        lineHeight: "19px",
        padding: "0 4px",
        minWidth: 17,
        borderRadius: theme.shape.borderRadius,
        display: "inline-block",
        "&:not(:first-of-type)": {
            marginLeft: 1,
        },
    },
}));
function MenuButtonTooltip(_a) {
    var { label, shortcutKeys, placement = "top", contentWrapperClassName, children } = _a, otherTooltipProps = __rest(_a, ["label", "shortcutKeys", "placement", "contentWrapperClassName", "children"]);
    const { classes } = useStyles();
    return ((0, jsx_runtime_1.jsx)(material_1.Tooltip, Object.assign({ title: label || (shortcutKeys && shortcutKeys.length > 0) ? ((0, jsx_runtime_1.jsxs)("div", { className: classes.titleContainer, children: [(0, jsx_runtime_1.jsx)("div", { className: classes.label, children: label }), shortcutKeys && shortcutKeys.length > 0 && ((0, jsx_runtime_1.jsx)(material_1.Typography, { variant: "body2", component: "div", children: shortcutKeys.map((shortcutKey, index) => ((0, jsx_runtime_1.jsx)("span", { className: classes.shortcutKey, children: shortcutKey === "mod" ? (0, platform_1.getModShortcutKey)() : shortcutKey }, index))) }))] })) : (""), placement: placement, arrow: true }, otherTooltipProps, { children: (0, jsx_runtime_1.jsx)("span", { className: contentWrapperClassName, children: children }) })));
}
exports.default = MenuButtonTooltip;

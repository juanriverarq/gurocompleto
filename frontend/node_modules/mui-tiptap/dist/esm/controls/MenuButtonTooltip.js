import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tooltip, Typography, alpha } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { getModShortcutKey } from "../utils/platform";
const useStyles = makeStyles({ name: { MenuButtonTooltip } })((theme) => ({
    titleContainer: {
        textAlign: "center",
    },
    label: {
        fontSize: theme.typography.pxToRem(13),
    },
    shortcutKey: {
        fontSize: theme.typography.pxToRem(12),
        border: `1px solid ${alpha(theme.palette.text.secondary, 0.2)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.3),
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
export default function MenuButtonTooltip({ label, shortcutKeys, placement = "top", contentWrapperClassName, children, ...otherTooltipProps }) {
    const { classes } = useStyles();
    return (_jsx(Tooltip, { title: label || (shortcutKeys && shortcutKeys.length > 0) ? (_jsxs("div", { className: classes.titleContainer, children: [_jsx("div", { className: classes.label, children: label }), shortcutKeys && shortcutKeys.length > 0 && (_jsx(Typography, { variant: "body2", component: "div", children: shortcutKeys.map((shortcutKey, index) => (_jsx("span", { className: classes.shortcutKey, children: shortcutKey === "mod" ? getModShortcutKey() : shortcutKey }, index))) }))] })) : (""), placement: placement, arrow: true, ...otherTooltipProps, children: _jsx("span", { className: contentWrapperClassName, children: children }) }));
}

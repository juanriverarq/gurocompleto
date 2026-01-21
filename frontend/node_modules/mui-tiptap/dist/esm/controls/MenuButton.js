import { jsx as _jsx } from "react/jsx-runtime";
import { ToggleButton, toggleButtonClasses, } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import MenuButtonTooltip from "./MenuButtonTooltip";
export const MENU_BUTTON_FONT_SIZE_DEFAULT = "1.25rem";
const useStyles = makeStyles({ name: { MenuButton } })({
    root: {
        // Use && for additional specificity, since MUI's conditional "disabled"
        // styles also set the border
        [`&& .${toggleButtonClasses.root}`]: {
            border: "none",
            padding: 5,
        },
    },
    menuButtonIcon: {
        fontSize: MENU_BUTTON_FONT_SIZE_DEFAULT,
    },
});
/**
 * A general-purpose base component for showing an editor control for use in a
 * menu.
 */
export default function MenuButton({ tooltipLabel, tooltipShortcutKeys, IconComponent, buttonRef, children, ...toggleButtonProps }) {
    const { classes } = useStyles();
    return (_jsx("span", { className: classes.root, children: _jsx(MenuButtonTooltip, { label: tooltipLabel, shortcutKeys: tooltipShortcutKeys, children: _jsx(ToggleButton, { ref: buttonRef, size: "small", value: tooltipLabel, ...toggleButtonProps, children: children !== null && children !== void 0 ? children : (IconComponent && (_jsx(IconComponent, { className: classes.menuButtonIcon }))) }) }) }));
}

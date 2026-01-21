/// <reference types="react" />
import { type TooltipProps } from "@mui/material";
export type MenuButtonTooltipProps = {
    /**
     * Used to display what this button is responsible for. Ex: "Ordered list".
     */
    label: string;
    /**
     * An array representing the set of keys that should be pressed to trigger
     * this action (for its keyboard shortcut), so that this can be displayed to
     * the user. If empty, no keyboard shortcut is displayed.
     *
     * Use the literal string "mod" to represent Cmd on Mac and Ctrl on Windows
     * and Linux.
     *
     * Example: ["mod", "Shift", "7"] is the array that should be provided as the
     * combination for toggling an ordered list.
     *
     * For the list of pre-configured Tiptap shortcuts, see
     * https://tiptap.dev/api/keyboard-shortcuts.
     */
    shortcutKeys?: string[];
    /** Where the tooltip should be placed. By default "top" (above). */
    placement?: TooltipProps["placement"];
    /**
     * Class applied to the element that contains the children content. We add an
     * intermediary element since Tooltip requires a non-disabled child element in
     * order to render, and we want to allow tooltips to show up even when buttons
     * are disabled.
     */
    contentWrapperClassName?: string;
    /** The menu element for which we're showing a tooltip when hovering. */
    children: React.ReactNode;
} & Pick<TooltipProps, "open" | "onOpen" | "onClose">;
export default function MenuButtonTooltip({ label, shortcutKeys, placement, contentWrapperClassName, children, ...otherTooltipProps }: MenuButtonTooltipProps): import("react/jsx-runtime").JSX.Element;

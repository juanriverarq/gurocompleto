/**
 * A horizontal bar that is used as a color indicator, matching position and
 * appearance of the bar in icons like FormatColorText, BorderColor, etc. from
 * @mui/icons-material.
 *
 * This allows for rendering the color indication separately from the other
 * portion of the icon (the text letter, highlighter, etc.) when used with icons
 * like FormatColorTextNoBar, FormatInkHighlighterNoBar, and BorderColorNoBar.
 */
declare const FormatColorBar: import("@mui/material/OverridableComponent").OverridableComponent<import("@mui/material").SvgIconTypeMap<{}, "svg">> & {
    muiName: string;
};
export default FormatColorBar;

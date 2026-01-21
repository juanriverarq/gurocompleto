/**
 * A modified version of the FormatInkHighlighter icon, with the horizontal bar
 * below the highlighter removed.
 *
 * This allows us to control/render the color of the bar independently, via a
 * separate icon (mui-tipap's FormatColorBar).
 */
declare const FormatInkHighlighterNoBar: import("@mui/material/OverridableComponent").OverridableComponent<import("@mui/material").SvgIconTypeMap<{}, "svg">> & {
    muiName: string;
};
export default FormatInkHighlighterNoBar;

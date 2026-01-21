/**
 * A modified version of the FormatColorFill icon from @mui/icons-material, with
 * the horizontal bar below the "fill bucket" removed.
 *
 * This allows us to control/render the color of the bar independently, via a
 * separate icon (mui-tipap's FormatColorBar).
 */
declare const FormatColorFillNoBar: import("@mui/material/OverridableComponent").OverridableComponent<import("@mui/material").SvgIconTypeMap<{}, "svg">> & {
    muiName: string;
};
export default FormatColorFillNoBar;

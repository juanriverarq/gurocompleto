/**
 * A modified version of the FormatColorText icon from @mui/icons-material, with
 * the horizontal bar below the "A" letter removed.
 *
 * This allows us to control/render the color of the bar independently, via a
 * separate icon (mui-tipap's FormatColorBar).
 */
declare const FormatColorTextNoBar: import("@mui/material/OverridableComponent").OverridableComponent<import("@mui/material").SvgIconTypeMap<{}, "svg">> & {
    muiName: string;
};
export default FormatColorTextNoBar;

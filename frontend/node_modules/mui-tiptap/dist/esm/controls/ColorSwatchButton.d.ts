import { type ComponentPropsWithoutRef } from "react";
import type { Except } from "type-fest";
export interface ColorSwatchButtonProps extends Except<ComponentPropsWithoutRef<"button">, "color"> {
    /**
     * What color is shown with this swatch. If not provided, shows a checkerboard
     * pattern, typically used as "not set" or "transparent".
     */
    value?: string;
    /**
     * An optional human-friendly name for this color, used as an aria-label for
     * the button.
     */
    label?: string;
    /**
     * Whether this swatch color is the currently active color. If true, shows an
     * overlaid checkmark as a visual indicator.
     */
    active?: boolean;
    /** If given, sets the padding between the color and the border of the swatch. */
    padding?: string | number;
}
/**
 * Renders a button in the given color `value`, useful for showing and allowing
 * selecting a color preset.
 */
export declare const ColorSwatchButton: import("react").ForwardRefExoticComponent<ColorSwatchButtonProps & import("react").RefAttributes<HTMLButtonElement>>;

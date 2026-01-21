import { type PopperProps } from "@mui/material";
import type { MenuButtonColorPickerProps } from "./MenuButtonColorPicker";
export interface ColorPickerPopperBodyProps extends Pick<MenuButtonColorPickerProps, "swatchColors" | "labels" | "ColorPickerProps"> {
    /** The current color value. Must be a valid CSS color string. */
    value: string;
    /** Callback when the user is saving/changing the current color. */
    onSave: (newColor: string) => void;
    /** Callback when the user is canceling updates to the current color. */
    onCancel: () => void;
}
export interface ColorPickerPopperProps extends PopperProps, ColorPickerPopperBodyProps {
}
export declare function ColorPickerPopperBody({ value, onCancel, onSave, swatchColors, labels, ColorPickerProps, }: ColorPickerPopperBodyProps): import("react/jsx-runtime").JSX.Element;
/**
 * Renders the ColorPicker inside of a Popper interface, for use with the
 * MenuButtonColorPicker.
 */
export declare function ColorPickerPopper({ value, onSave, onCancel, swatchColors, ColorPickerProps, labels, ...popperProps }: ColorPickerPopperProps): import("react/jsx-runtime").JSX.Element;

import type { PopperProps } from "@mui/material";
import { type ReactNode } from "react";
import type { Except } from "type-fest";
import type { ColorPickerProps, SwatchColorOption } from "./ColorPicker";
import { type MenuButtonProps } from "./MenuButton";
export interface MenuButtonColorPickerProps extends Except<MenuButtonProps, "color" | "value" | "onChange"> {
    /** The current CSS color string value. */
    value: string | undefined;
    /** Callback when the color changes. */
    onChange: (newColor: string) => void;
    /**
     * Provide default list of colors (must be valid CSS color strings) which
     * are used to form buttons for color swatches.
     */
    swatchColors?: SwatchColorOption[];
    /**
     * If true, hides the horizontal bar at the base of the icon/button area that
     * shows the currently active color `value`. The indicator pairs well with
     * `*NoBar` icons like `FormatColorTextNoBar`, so you may want to hide it if
     * your `IconComponent` clashes. By default false.
     */
    hideColorIndicator?: boolean;
    /**
     * Override the props for the popper that houses the color picker interface.
     */
    PopperProps?: Partial<PopperProps>;
    /** Override the props for the color picker. */
    ColorPickerProps?: Partial<ColorPickerProps>;
    /**
     * Unique HTML ID for the color picker popper that will be shown when clicking
     * this button (used for aria-describedby for accessibility).
     */
    popperId?: string;
    /** Override the default labels for any of the content. */
    labels?: {
        /**
         * Button label for removing the currently set color (setting the color to
         * ""). By default "None".
         */
        removeColorButton?: ReactNode;
        /**
         * Tooltip title for the button that removes the currently set color. By
         * default "" (no tooltip shown).
         */
        removeColorButtonTooltipTitle?: ReactNode;
        /**
         * Button label for canceling updating the color in the picker. By default
         * "Cancel".
         */
        cancelButton?: ReactNode;
        /**
         * Button label for saving the color chosen in the interface. By default
         * "OK".
         */
        saveButton?: ReactNode;
        /**
         * The placeholder shown in the text field entry for color. By default:
         * 'Ex: "#7cb5ec"'
         */
        textFieldPlaceholder?: string;
    };
}
export declare function MenuButtonColorPicker({ value: colorValue, onChange, swatchColors, labels, hideColorIndicator, popperId, PopperProps, ColorPickerProps, ...menuButtonProps }: MenuButtonColorPickerProps): import("react/jsx-runtime").JSX.Element;

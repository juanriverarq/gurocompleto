import { type MenuButtonColorPickerProps } from "./MenuButtonColorPicker";
export interface MenuButtonHighlightColorProps extends Partial<MenuButtonColorPickerProps> {
    /**
     * Shows this as the current highlight color (in the color picker) if a
     * highlight is active for the selected editor text but no specific color was
     * specified for it.
     *
     * The Tiptap Highlight extension uses HTML `<mark>` elements, so this default
     * color should be chosen based on any styling applied to mark
     * background-color on your page.
     *
     * This prop is set to "#ffff00" (yellow) by default, as this is what most
     * browsers will show, per the W3 spec defaults
     * https://stackoverflow.com/a/34969133/4543977.
     */
    defaultMarkColor?: string;
}
/**
 * Control for a user to choose a text highlight color, for the
 * @tiptap/extension-highlight when it's configured with
 * `Highlight.configure({ multicolor: true })`.
 *
 * See also MenuButtonHighlightToggle for a simple "on off" highlight toggle
 * control, for use with the Highlight extension when not using multicolor.
 */
export default function MenuButtonHighlightColor({ defaultMarkColor, ...menuButtonProps }: MenuButtonHighlightColorProps): import("react/jsx-runtime").JSX.Element;

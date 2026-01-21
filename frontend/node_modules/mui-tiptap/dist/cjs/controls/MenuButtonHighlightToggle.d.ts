import { type MenuButtonProps } from "./MenuButton";
export type MenuButtonHighlightToggleProps = Partial<MenuButtonProps>;
/**
 * Control for a user to toggle text highlighting with the
 * @tiptap/extension-highlight, just using the default `<mark>`
 * background-color.
 *
 * This is typically useful when using the default Highlight extension
 * configuration (*not* configuring with `mulitcolor: true`). See
 * MenuButtonHighlightColor for a multicolor-oriented color-selection highlight
 * control.
 */
export default function MenuButtonHighlightToggle({ ...menuButtonProps }: MenuButtonHighlightToggleProps): import("react/jsx-runtime").JSX.Element;

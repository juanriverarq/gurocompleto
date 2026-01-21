import { type MenuButtonColorPickerProps } from "./MenuButtonColorPicker";
export interface MenuButtonTextColorProps extends Partial<MenuButtonColorPickerProps> {
    /**
     * Used to indicate the default color of the text in the Tiptap editor, if no
     * color has been set with the color extension (or if color has been *unset*
     * with the extension). Typically should be set to the same value as the MUI
     * `theme.palette.text.primary`.
     */
    defaultTextColor?: string;
}
export default function MenuButtonTextColor({ IconComponent, tooltipLabel, defaultTextColor, ...menuButtonProps }: MenuButtonTextColorProps): import("react/jsx-runtime").JSX.Element;

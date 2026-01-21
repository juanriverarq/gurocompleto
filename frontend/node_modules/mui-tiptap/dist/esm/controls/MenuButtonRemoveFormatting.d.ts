import { type MenuButtonProps } from "./MenuButton";
export type MenuButtonRemoveFormattingProps = Partial<MenuButtonProps>;
/**
 * A control button removes all inline formatting of marks by calling Tiptap’s
 * unsetAllMarks command (https://tiptap.dev/api/commands/unset-all-marks).
 */
export default function MenuButtonRemoveFormatting(props: MenuButtonRemoveFormattingProps): import("react/jsx-runtime").JSX.Element;

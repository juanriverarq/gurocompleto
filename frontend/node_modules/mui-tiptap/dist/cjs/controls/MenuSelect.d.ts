import { type SelectProps } from "@mui/material";
export type MenuSelectProps<T> = SelectProps<T> & {
    /** An optional tooltip to show when hovering over this Select. */
    tooltipTitle?: string;
};
/** A Select that is styled to work well with other menu bar controls. */
export default function MenuSelect<T>({ tooltipTitle, ...selectProps }: MenuSelectProps<T>): import("react/jsx-runtime").JSX.Element;

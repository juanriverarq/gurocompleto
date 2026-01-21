/// <reference types="react" />
import type { Except } from "type-fest";
import { type DebounceRenderProps } from "../utils/DebounceRender";
export type MenuControlsContainerProps = {
    /** The set of controls (buttons, etc) to include in the menu bar. */
    children?: React.ReactNode;
    className?: string;
    /**
     * If true, the rendering of the children content here will be debounced, as a
     * way to improve performance. If this component is rendered in the same
     * context as Tiptap's `useEditor` and *not* debounced, then upon every editor
     * interaction (caret movement, character typed, etc.), the entire controls
     * content will re-render, which can bog down the editor, so debouncing is
     * usually recommended. Controls are often expensive to render since they need
     * to check a lot of editor state, with `editor.can()` commands and whatnot.
     */
    debounced?: boolean;
    /**
     * Override the props/options used with debounce rendering such as the wait
     * interval, if `debounced` is true.
     */
    DebounceProps?: Except<DebounceRenderProps, "children">;
};
/** Provides consistent spacing between different editor controls components. */
export default function MenuControlsContainer({ children, className, debounced, DebounceProps, }: MenuControlsContainerProps): import("react/jsx-runtime").JSX.Element;

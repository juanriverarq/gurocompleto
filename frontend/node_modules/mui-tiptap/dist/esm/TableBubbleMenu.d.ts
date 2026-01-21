import type { Except } from "type-fest";
import { type ControlledBubbleMenuProps } from "./ControlledBubbleMenu";
import { type TableMenuControlsProps } from "./controls/TableMenuControls";
import { type DebounceRenderProps } from "./utils/DebounceRender";
export type TableBubbleMenuProps = {
    /**
     * If true, the rendering of the table controls will not be debounced. If not
     * debounced, then upon every editor interaction (caret movement, character
     * typed, etc.), the entire content will re-render, which tends to be
     * expensive and can bog down the editor performance, so debouncing is
     * generally recommended. By default false.
     */
    disableDebounce?: boolean;
    /**
     * Override the props/options used with debounce rendering such as the wait
     * interval, if `disableDebounce` is not true.
     */
    DebounceProps?: Except<DebounceRenderProps, "children">;
    /**
     * Override the default labels for any of the menu buttons. If any is omitted,
     * it falls back to the default mui-tiptap label for that label.
     */
    labels?: TableMenuControlsProps["labels"];
} & Partial<Except<ControlledBubbleMenuProps, "open" | "editor" | "children">>;
/**
 * Renders a bubble menu to manipulate the contents of a Table (add or delete
 * columns or rows, merge cells, etc.), when the user's caret/selection is
 * inside a Table.
 *
 * For use with mui-tiptap's `TableImproved` extension or Tiptap's
 * `@tiptap/extension-table` extension.
 *
 * If you're using `RichTextEditor`, include this component via
 * `RichTextEditor`’s `children` render-prop. Otherwise, include the
 * `TableBubbleMenu` as a child of the component where you call `useEditor` and
 * render your `RichTextField` or `RichTextContent`. (The bubble menu itself
 * will be positioned appropriately no matter where you put it in your React
 * tree, as long as it is re-rendered whenever the Tiptap `editor` forces an
 * update, which will happen if it's a child of the component using
 * `useEditor`).
 */
export default function TableBubbleMenu({ disableDebounce, DebounceProps, labels, ...controlledBubbleMenuProps }: TableBubbleMenuProps): import("react/jsx-runtime").JSX.Element | null;

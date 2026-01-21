export type TableMenuControlsProps = {
    /** Class applied to the root controls container element. */
    className?: string;
    /**
     * Override the default labels for any of the menu buttons. For any value that
     * is omitted in this object, it falls back to the default content.
     */
    labels?: {
        insertColumnBefore?: string;
        insertColumnAfter?: string;
        deleteColumn?: string;
        insertRowAbove?: string;
        insertRowBelow?: string;
        deleteRow?: string;
        mergeCells?: string;
        splitCell?: string;
        toggleHeaderRow?: string;
        toggleHeaderColumn?: string;
        toggleHeaderCell?: string;
        deleteTable?: string;
    };
};
/**
 * Renders all of the controls for manipulating a table in a Tiptap editor
 * (add or delete columns or rows, merge cells, etc.).
 */
export default function TableMenuControls({ className, labels, }: TableMenuControlsProps): import("react/jsx-runtime").JSX.Element;

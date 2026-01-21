/**
 * Extend the standard Table extension, but ensures that columns maintain their
 * previously set widths even when `editable=false`, and irrespective of the
 * initial `editable` state when the `editor` is created.
 */
declare const TableImproved: import("@tiptap/core").Node<import("@tiptap/extension-table").TableOptions, any>;
export default TableImproved;

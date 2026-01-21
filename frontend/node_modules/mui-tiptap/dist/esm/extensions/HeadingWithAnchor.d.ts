import type { Editor } from "@tiptap/core";
import { type HeadingOptions } from "@tiptap/extension-heading";
export type HeadingWithAnchorOptions = HeadingOptions & {
    /**
     * If true, checks whether the current URL hash string indicates we should be
     * anchored to a specific heading, and if so, scrolls to that heading after
     * rendering editor content. Since Tiptap's editor does not add content to the
     * DOM on initial/server render, this must be set to true in order to scroll
     * after mounting.
     *
     * You may want to set this to `false` if you are using the Collaboration
     * extension and the Y.Doc hasn't yet synced, since the collaboration document
     * won't have content still on mount. In that case, you can handle scrolling
     * to an anchor separately via the collaboration sync callback, using the
     * exported scrollToCurrentAnchor function.
     */
    scrollToAnchorOnMount: boolean;
};
/**
 * A modified version of Tiptap’s `Heading` extension
 * (https://tiptap.dev/api/nodes/heading), with dynamic GitHub-like anchor links
 * for every heading you add. An anchor link button appears to the left of each
 * heading when you hovering over it, when the `editor` has `editable` set to
 * `false`. This allows users to share links and jump to specific headings
 * within your rendered editor content. It can also accommodate building a table
 * of contents or outline more easily.
 */
declare const HeadingWithAnchor: import("@tiptap/core").Node<HeadingWithAnchorOptions, any>;
export default HeadingWithAnchor;
/**
 * If there's a URL hash string indicating we should be anchored to a specific
 * heading, this function scrolls to that heading.
 *
 * We have to do this manually/programmatically after first render using this
 * function, since when the page first loads, the editor content will not be
 * mounted/rendered, so the browser doesn't move to the anchor automatically
 * just from having the anchor in the URL. Note that we only want to do this
 * once on mount/create.
 */
export declare function scrollToCurrentHeadingAnchor(editor: Editor): void;

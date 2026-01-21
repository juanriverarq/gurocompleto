import type { Editor } from "@tiptap/core";
export type ImageNodeAttributes = {
    /** The URL at which this image can be served. Used as <img> `src`. */
    src: string;
    /** Alt text for the image. */
    alt?: string;
    /** The `title` attribute when we render the image element. */
    title?: string;
};
/**
 * Insert the given array of images into the Tiptap editor document content.
 *
 * Optionally specify a given position at which to insert the images into the
 * editor content. If not given, the user's current selection (if there is any)
 * will be replaced by the newly inserted images.
 *
 * @param options.images The attributes of each image to insert
 * @param options.editor The Tiptap editor in which to insert
 * @param options.position The position at which to insert into the editor
 * content. If not given, uses the current editor caret/selection position.
 */
export declare function insertImages({ images, editor, position, }: {
    images: ImageNodeAttributes[];
    editor: Editor | null;
    position?: number;
}): void;

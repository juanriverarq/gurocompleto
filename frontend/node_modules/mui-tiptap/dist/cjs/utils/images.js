"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertImages = void 0;
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
function insertImages({ images, editor, position, }) {
    if (!editor || editor.isDestroyed || images.length === 0) {
        return;
    }
    const imageContentToInsert = images
        .filter((imageAttrs) => !!imageAttrs.src)
        .map((imageAttrs) => ({
        type: editor.schema.nodes.image.name,
        attrs: imageAttrs,
    }));
    editor
        .chain()
        .command(({ commands }) => {
        if (position == null) {
            // We'll insert at and replace the user's current selection if there
            // wasn't a specific insert position given
            return commands.insertContent(imageContentToInsert);
        }
        else {
            return commands.insertContentAt(position, imageContentToInsert);
        }
    })
        .focus()
        .run();
}
exports.insertImages = insertImages;

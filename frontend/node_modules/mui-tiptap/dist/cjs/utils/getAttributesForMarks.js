"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttributesForMarks = void 0;
const core_1 = require("@tiptap/core");
/**
 * Get the attributes of all currently selected marks of the given type or
 * name.
 *
 * Returns an array of Records, with an entry for each matching mark that is
 * currently selected.
 *
 * Based directly on Tiptap's getMarkAttributes
 * (https://github.com/ueberdosis/tiptap/blob/f387ad3dd4c2b30eaea33fb0ba0b42e0cd39263b/packages/core/src/helpers/getMarkAttributes.ts),
 * but returns results for each of the matching marks, rather than just the
 * first. See related: https://github.com/ueberdosis/tiptap/issues/3481
 */
function getAttributesForMarks(state, typeOrName
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
    const type = (0, core_1.getMarkType)(typeOrName, state.schema);
    const { from, to, empty } = state.selection;
    const marks = [];
    if (empty) {
        if (state.storedMarks) {
            marks.push(...state.storedMarks);
        }
        marks.push(...state.selection.$head.marks());
    }
    else {
        state.doc.nodesBetween(from, to, (node) => {
            marks.push(...node.marks);
        });
    }
    return marks
        .filter((markItem) => markItem.type.name === type.name)
        .map((mark) => (Object.assign({}, mark.attrs)));
}
exports.getAttributesForMarks = getAttributesForMarks;

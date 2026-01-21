import { getSchemaTypeNameByName } from "@tiptap/core";
import { getAttributesForMarks } from "./getAttributesForMarks";
import { getAttributesForNodes } from "./getAttributesForNodes";
/**
 * Get the attributes of all currently selected marks and nodes of the given
 * type or name.
 *
 * Returns an array of Records, with an entry for each matching mark/node that
 * is currently selected.
 *
 * NOTE: This function will omit any non-matching nodes/marks in the result
 * array. It may be useful to run `editor.isActive(typeOrName)` separately if
 * you want to guarantee that all selected content is of the given type/name.
 *
 * Based directly on Tiptap's getAttributes
 * (https://github.com/ueberdosis/tiptap/blob/f387ad3dd4c2b30eaea33fb0ba0b42e0cd39263b/packages/core/src/helpers/getAttributes.ts),
 * but returns results for each of the matching marks and nodes, rather than
 * just the first. This enables us to handle situations where there are multiple
 * different attributes set for the different marks/nodes. See related issue
 * here: https://github.com/ueberdosis/tiptap/issues/3481
 */
export function getAttributesForEachSelected(state, typeOrName
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
    const schemaType = getSchemaTypeNameByName(typeof typeOrName === "string" ? typeOrName : typeOrName.name, state.schema);
    if (schemaType === "node") {
        return getAttributesForNodes(state, typeOrName);
    }
    if (schemaType === "mark") {
        return getAttributesForMarks(state, typeOrName);
    }
    return [];
}

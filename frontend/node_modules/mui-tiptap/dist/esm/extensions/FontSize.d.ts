import { Extension } from "@tiptap/core";
export type FontSizeAttrs = {
    fontSize?: string | null;
};
export type FontSizeOptions = {
    /**
     * What types of marks this applies to. By default just "textStyle".
     * (https://tiptap.dev/api/marks/text-style).
     */
    types: string[];
};
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        fontSize: {
            /**
             * Set the text font size. ex: "12px", "2em", or "small". Must be a valid
             * CSS font-size
             * (https://developer.mozilla.org/en-US/docs/Web/CSS/font-size).
             */
            setFontSize: (fontSize: string) => ReturnType;
            /**
             * Unset the text font size.
             */
            unsetFontSize: () => ReturnType;
        };
    }
}
/**
 * Allow for setting the font size of text. Requires the TextStyle extension
 * https://tiptap.dev/api/marks/text-style, as Tiptap suggests.
 */
declare const FontSize: Extension<FontSizeOptions, any>;
export default FontSize;

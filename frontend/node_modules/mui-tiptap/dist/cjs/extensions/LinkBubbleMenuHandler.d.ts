import { Extension } from "@tiptap/core";
import type { LinkBubbleMenuProps } from "../LinkBubbleMenu";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        linkBubbleMenu: {
            /**
             * Open/show the link bubble menu. Create a link if one doesn't exist at
             * the current cursor selection, or edit the existing link if there is
             * already a link at the current selection.
             *
             * If the options are provided, they're used to override the bubble menu
             * props, which can be useful for specific positioning needs. Each call to
             * `openLinkBubbleMenu` will reset the options based on the provided
             * argument, falling back to default behavior if not provided.
             *
             * For instance, if the anchorEl option is provided, it overrides the
             * anchor point for positioning the bubble menu. (The default anchorEl for
             * LinkBubbleMenu is to anchor to the location in the editor content where
             * the link appears or will appear.)
             */
            openLinkBubbleMenu: (options?: Partial<LinkBubbleMenuProps>) => ReturnType;
            /**
             * Edit an existing link in the bubble menu, to be used when currently
             * viewing a link in the already-opened bubble menu.
             */
            editLinkInBubbleMenu: () => ReturnType;
            /** Close/hide the link bubble menu, canceling any ongoing edits. */
            closeLinkBubbleMenu: () => ReturnType;
        };
    }
}
export declare enum LinkMenuState {
    HIDDEN = 0,
    VIEW_LINK_DETAILS = 1,
    EDIT_LINK = 2
}
export type LinkBubbleMenuHandlerStorage = {
    state: LinkMenuState;
    bubbleMenuOptions: Partial<LinkBubbleMenuProps> | undefined;
};
/**
 * To be used in conjunction with the `LinkBubbleMenu` component, as this
 * extension provides editor commands to control the state of the link bubble
 * menu.
 *
 * The Tiptap Link extension (@tiptap/extension-link) should also be installed
 * and included in your extensions when using LinkBubbleMenuHandler:
 * https://tiptap.dev/api/marks/link.
 */
declare const LinkBubbleMenuHandler: Extension<undefined, LinkBubbleMenuHandlerStorage>;
export default LinkBubbleMenuHandler;

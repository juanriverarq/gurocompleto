import { type Editor } from "@tiptap/core";
import type { ReactNode } from "react";
export type ViewLinkMenuContentProps = {
    editor: Editor;
    onCancel: () => void;
    onEdit: () => void;
    onRemove: () => void;
    /** Override default text content/labels used within the component. */
    labels?: {
        /** Content shown in the button used to start editing the link. */
        viewLinkEditButtonLabel?: ReactNode;
        /** Content shown in the button used to remove the link. */
        viewLinkRemoveButtonLabel?: ReactNode;
    };
};
/** Shown when a user is viewing the details of an existing Link for Tiptap. */
export default function ViewLinkMenuContent({ editor, onCancel, onEdit, onRemove, labels, }: ViewLinkMenuContentProps): import("react/jsx-runtime").JSX.Element;

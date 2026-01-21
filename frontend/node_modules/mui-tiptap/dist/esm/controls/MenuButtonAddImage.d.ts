import type { SetRequired } from "type-fest";
import { type MenuButtonProps } from "./MenuButton";
/**
 * You must provide your own `onClick` handler.
 */
export type MenuButtonAddImageProps = SetRequired<Partial<MenuButtonProps>, "onClick">;
/**
 * Render a button for adding an image to the editor content. You must provide
 * your own `onClick` prop in order to specify *how* the image is added. For
 * instance, you might open a popup for the user to provide an image URL, or you
 * might trigger a file upload via file input dialog.
 *
 * Once the image URL is ready (after the user has filled it out or after an
 * upload has completed), you can typically use something like:
 *
 *   editor.chain().focus().setImage({ src: url }).run()
 *
 * See Tiptap's example here https://tiptap.dev/api/nodes/image.
 */
export default function MenuButtonAddImage({ ...props }: MenuButtonAddImageProps): import("react/jsx-runtime").JSX.Element;

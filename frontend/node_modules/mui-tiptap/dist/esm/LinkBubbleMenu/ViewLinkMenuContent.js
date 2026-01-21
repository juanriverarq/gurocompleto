import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Button, DialogActions, Link } from "@mui/material";
import { getMarkRange, getMarkType } from "@tiptap/core";
import truncate from "lodash/truncate";
import { makeStyles } from "tss-react/mui";
import useKeyDown from "../hooks/useKeyDown";
import truncateMiddle from "../utils/truncateMiddle";
const useStyles = makeStyles({ name: { ViewLinkMenuContent } })({
    linkPreviewText: {
        overflowWrap: "anywhere",
    },
});
/** Shown when a user is viewing the details of an existing Link for Tiptap. */
export default function ViewLinkMenuContent({ editor, onCancel, onEdit, onRemove, labels, }) {
    var _a, _b, _c;
    const { classes } = useStyles();
    const linkRange = getMarkRange(editor.state.selection.$to, getMarkType("link", editor.schema));
    const linkText = linkRange
        ? editor.state.doc.textBetween(linkRange.from, linkRange.to)
        : "";
    const currentHref = (_a = editor.getAttributes("link").href) !== null && _a !== void 0 ? _a : "";
    // If the user presses escape, we should cancel
    useKeyDown("Escape", onCancel);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: classes.linkPreviewText, children: truncate(linkText, {
                    length: 50,
                    omission: "…",
                }) }), _jsx("div", { className: classes.linkPreviewText, children: _jsx(Link, { href: currentHref, target: "_blank", rel: "noopener", children: truncateMiddle(currentHref, 50) }) }), _jsxs(DialogActions, { sx: { px: 0 }, children: [_jsx(Button, { onClick: onEdit, color: "primary", variant: "outlined", size: "small", children: (_b = labels === null || labels === void 0 ? void 0 : labels.viewLinkEditButtonLabel) !== null && _b !== void 0 ? _b : "Edit" }), _jsx(Button, { onClick: onRemove, color: "error", variant: "outlined", size: "small", children: (_c = labels === null || labels === void 0 ? void 0 : labels.viewLinkRemoveButtonLabel) !== null && _c !== void 0 ? _c : "Remove" })] })] }));
}

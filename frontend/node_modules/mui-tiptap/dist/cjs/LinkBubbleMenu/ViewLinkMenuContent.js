"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const core_1 = require("@tiptap/core");
const truncate_1 = __importDefault(require("lodash/truncate"));
const mui_1 = require("tss-react/mui");
const useKeyDown_1 = __importDefault(require("../hooks/useKeyDown"));
const truncateMiddle_1 = __importDefault(require("../utils/truncateMiddle"));
const useStyles = (0, mui_1.makeStyles)({ name: { ViewLinkMenuContent } })({
    linkPreviewText: {
        overflowWrap: "anywhere",
    },
});
/** Shown when a user is viewing the details of an existing Link for Tiptap. */
function ViewLinkMenuContent({ editor, onCancel, onEdit, onRemove, labels, }) {
    var _a, _b, _c;
    const { classes } = useStyles();
    const linkRange = (0, core_1.getMarkRange)(editor.state.selection.$to, (0, core_1.getMarkType)("link", editor.schema));
    const linkText = linkRange
        ? editor.state.doc.textBetween(linkRange.from, linkRange.to)
        : "";
    const currentHref = (_a = editor.getAttributes("link").href) !== null && _a !== void 0 ? _a : "";
    // If the user presses escape, we should cancel
    (0, useKeyDown_1.default)("Escape", onCancel);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: classes.linkPreviewText, children: (0, truncate_1.default)(linkText, {
                    length: 50,
                    omission: "…",
                }) }), (0, jsx_runtime_1.jsx)("div", { className: classes.linkPreviewText, children: (0, jsx_runtime_1.jsx)(material_1.Link, { href: currentHref, target: "_blank", rel: "noopener", children: (0, truncateMiddle_1.default)(currentHref, 50) }) }), (0, jsx_runtime_1.jsxs)(material_1.DialogActions, { sx: { px: 0 }, children: [(0, jsx_runtime_1.jsx)(material_1.Button, { onClick: onEdit, color: "primary", variant: "outlined", size: "small", children: (_b = labels === null || labels === void 0 ? void 0 : labels.viewLinkEditButtonLabel) !== null && _b !== void 0 ? _b : "Edit" }), (0, jsx_runtime_1.jsx)(material_1.Button, { onClick: onRemove, color: "error", variant: "outlined", size: "small", children: (_c = labels === null || labels === void 0 ? void 0 : labels.viewLinkRemoveButtonLabel) !== null && _c !== void 0 ? _c : "Remove" })] })] }));
}
exports.default = ViewLinkMenuContent;

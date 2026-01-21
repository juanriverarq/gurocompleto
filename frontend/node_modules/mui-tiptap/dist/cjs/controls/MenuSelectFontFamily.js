"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/// <reference types="@tiptap/extension-font-family" />
const material_1 = require("@mui/material");
const mui_1 = require("tss-react/mui");
const context_1 = require("../context");
const getAttributesForEachSelected_1 = require("../utils/getAttributesForEachSelected");
const MenuSelect_1 = __importDefault(require("./MenuSelect"));
const useStyles = (0, mui_1.makeStyles)({ name: { MenuSelectFontFamily } })({
    selectInput: {
        // We use a fixed width so that the Select element won't change sizes as
        // the selected option changes
        width: 55,
    },
});
// Use this as a sentinel value so we can handle the case that the user's
// selection includes multiple different font families. There won't be a visible
// "option" in the Select for this value, and this will allow the user to set
// the current font family to "Default" or to any of the multiple values, and
// have it take effect. See more comments around `currentFontFamily` below.
const MULTIPLE_FAMILIES_SELECTED_VALUE = "MULTIPLE";
/** A font-family selector for use with the Tiptap FontFamily extension.  */
function MenuSelectFontFamily(_a) {
    var _b;
    var { options, hideUnsetOption = false, unsetOptionLabel = "Default", emptyLabel = "Font" } = _a, menuSelectProps = __rest(_a, ["options", "hideUnsetOption", "unsetOptionLabel", "emptyLabel"]);
    const { classes, cx } = useStyles();
    const editor = (0, context_1.useRichTextEditorContext)();
    // Determine if all of the selected content shares the same set font family.
    // Scenarios:
    // 1) If there is exactly one font family amongst the selected content and all
    //    of the selected content has the font family set, we'll show that as the
    //    current Selected value (as a user would expect).
    // 2) If there are multiple families used in the selected content or some
    //    selected content has font family set and other content does not, we'll
    //    assign the Select's `value` to a sentinel variable so that users can
    //    unset the families or can change to any given family.
    // 3) Otherwise (no font family is set in any selected content), we'll show the
    //    unsetOption as selected.
    const allCurrentTextStyleAttrs = editor
        ? (0, getAttributesForEachSelected_1.getAttributesForEachSelected)(editor.state, "textStyle")
        : [];
    const isTextStyleAppliedToEntireSelection = !!(editor === null || editor === void 0 ? void 0 : editor.isActive("textStyle"));
    const currentFontFamilies = allCurrentTextStyleAttrs.map((attrs) => { var _a; return (_a = attrs.fontFamily) !== null && _a !== void 0 ? _a : ""; } // Treat any null/missing font-family as ""
    );
    if (!isTextStyleAppliedToEntireSelection) {
        // If there is some selected content that does not have textStyle, we can
        // treat it the same as a selected textStyle mark with fontFamily set to
        // null or ""
        currentFontFamilies.push("");
    }
    const numUniqueCurrentFontFamilies = new Set(currentFontFamilies).size;
    let currentFontFamily;
    if (numUniqueCurrentFontFamilies === 1) {
        // There's exactly one font family selected, so show that
        currentFontFamily = currentFontFamilies[0];
    }
    else if (numUniqueCurrentFontFamilies > 1) {
        // There are multiple font families (either explicitly, or because some of the
        // selection has a font family set and some does not). This is similar to what
        // Microsoft Word and Google Docs do, for instance, showing the font family
        // input as blank when there are multiple values. If we simply set
        // currentFontFamily as "" here, then the "unset option" would show as
        // selected, which would prevent the user from unsetting the font families
        // for the selected content (since Select onChange does not fire when the
        // currently selected option is chosen again).
        currentFontFamily = MULTIPLE_FAMILIES_SELECTED_VALUE;
    }
    else {
        // Show as unset (empty), since there are no font families in any of the
        // selected content. This will show the "unset option" with the
        // unsetOptionLabel as selected, if `hideUnsetOption` is false.
        currentFontFamily = "";
    }
    return ((0, jsx_runtime_1.jsxs)(MenuSelect_1.default, Object.assign({ onChange: (event) => {
            const value = event.target.value;
            if (value) {
                editor === null || editor === void 0 ? void 0 : editor.chain().setFontFamily(value).focus().run();
            }
            else {
                editor === null || editor === void 0 ? void 0 : editor.chain().unsetFontFamily().focus().run();
            }
        }, disabled: 
        // Pass an arbitrary value just to check `can()`
        !(editor === null || editor === void 0 ? void 0 : editor.isEditable) || !editor.can().setFontFamily("serif"), renderValue: (value) => {
            var _a, _b;
            if (!value || value === MULTIPLE_FAMILIES_SELECTED_VALUE) {
                return emptyLabel;
            }
            return (_b = (_a = options.find((option) => option.value === value)) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : value;
        }, displayEmpty: true, "aria-label": "Font families", tooltipTitle: "Font" }, menuSelectProps, { 
        // We don't want to pass any non-string falsy values here, always falling
        // back to ""
        value: currentFontFamily || "", inputProps: Object.assign(Object.assign({}, menuSelectProps.inputProps), { className: cx(classes.selectInput, (_b = menuSelectProps.inputProps) === null || _b === void 0 ? void 0 : _b.className) }), children: [!hideUnsetOption && (
            // Allow users to unset the font-family
            (0, jsx_runtime_1.jsx)(material_1.MenuItem, { value: "", children: unsetOptionLabel })), (0, jsx_runtime_1.jsx)(material_1.MenuItem, { style: { display: "none" }, value: MULTIPLE_FAMILIES_SELECTED_VALUE }), options.map((fontFamilyOption) => {
                var _a;
                return ((0, jsx_runtime_1.jsx)(material_1.MenuItem, { value: fontFamilyOption.value, children: (0, jsx_runtime_1.jsx)("span", { style: { fontFamily: fontFamilyOption.value }, children: (_a = fontFamilyOption.label) !== null && _a !== void 0 ? _a : fontFamilyOption.value }) }, fontFamilyOption.value));
            })] })));
}
exports.default = MenuSelectFontFamily;

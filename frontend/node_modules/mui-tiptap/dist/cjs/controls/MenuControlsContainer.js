"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const mui_1 = require("tss-react/mui");
const DebounceRender_1 = __importDefault(require("../utils/DebounceRender"));
const useStyles = (0, mui_1.makeStyles)({
    name: { MenuControlsContainer: MenuControlsContainer },
})((theme) => {
    return {
        root: {
            display: "flex",
            rowGap: theme.spacing(0.3),
            columnGap: theme.spacing(0.3),
            alignItems: "center",
            flexWrap: "wrap",
        },
    };
});
/** Provides consistent spacing between different editor controls components. */
function MenuControlsContainer({ children, className, debounced, DebounceProps, }) {
    const { classes, cx } = useStyles();
    const content = (0, jsx_runtime_1.jsx)("div", { className: cx(classes.root, className), children: children });
    return debounced ? ((0, jsx_runtime_1.jsx)(DebounceRender_1.default, Object.assign({}, DebounceProps, { children: content }))) : (content);
}
exports.default = MenuControlsContainer;

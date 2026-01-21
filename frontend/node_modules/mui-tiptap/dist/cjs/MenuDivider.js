"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const mui_1 = require("tss-react/mui");
const useStyles = (0, mui_1.makeStyles)({ name: { MenuDivider } })((theme) => ({
    root: {
        height: 18,
        margin: theme.spacing(0, 0.5),
    },
}));
function MenuDivider(props) {
    const { classes, cx } = useStyles();
    return ((0, jsx_runtime_1.jsx)(material_1.Divider, Object.assign({ orientation: "vertical" }, props, { className: cx(classes.root, props.className) })));
}
exports.default = MenuDivider;

import { jsx as _jsx } from "react/jsx-runtime";
import { Divider } from "@mui/material";
import { makeStyles } from "tss-react/mui";
const useStyles = makeStyles({ name: { MenuDivider } })((theme) => ({
    root: {
        height: 18,
        margin: theme.spacing(0, 0.5),
    },
}));
export default function MenuDivider(props) {
    const { classes, cx } = useStyles();
    return (_jsx(Divider, { orientation: "vertical", ...props, className: cx(classes.root, props.className) }));
}

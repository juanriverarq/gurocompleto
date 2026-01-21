import { jsx as _jsx } from "react/jsx-runtime";
import { makeStyles } from "tss-react/mui";
import DebounceRender from "../utils/DebounceRender";
const useStyles = makeStyles({
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
export default function MenuControlsContainer({ children, className, debounced, DebounceProps, }) {
    const { classes, cx } = useStyles();
    const content = _jsx("div", { className: cx(classes.root, className), children: children });
    return debounced ? (_jsx(DebounceRender, { ...DebounceProps, children: content })) : (content);
}

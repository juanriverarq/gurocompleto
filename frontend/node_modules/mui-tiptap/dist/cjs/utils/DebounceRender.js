"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debounce_1 = __importDefault(require("lodash/debounce"));
const react_1 = require("react");
/**
 * This component debounces the rendering of its children.
 *
 * WARNING: Use with caution! This component should *only* be used when there
 * are updates triggered via "force-update" (like via Tiptap's `useEditor` hook
 * which updates upon ProseMirror editor changes to the selection, content,
 * etc.). For ordinary React components, traditional memoization techniques
 * around props and state (like useCallback, useMemo, memo, etc.) should be used
 * instead.
 *
 * This component is provided for a very narrow use-case: with our menu
 * controls, without debouncing the controls would re-render per editor state
 * change (e.g. for every character typed or for caret movement), which can bog
 * things down a bit, like when holding down backspace or typing very quickly.
 * (This is due to the way that Tiptap's useEditor re-renders upon changes in
 * the ProseMirror state, which is to force-update
 * https://github.com/ueberdosis/tiptap/blob/b0198eb14b98db5ca691bd9bfe698ffaddbc4ded/packages/react/src/useEditor.ts#L105-L113,
 * rather than in response to prop changes. Because of the force re-render, and
 * since we *do* want to watch editor updates, we have to debounce rendering a
 * bit less conventionally, rather than using callbacks, memo, etc.). We do
 * want/need the menu controls to update very frequently, since we need them to
 * reflect the state of the current cursor position and editor nodes/marks,
 * etc., but we want rendering to stay performant, so the `wait` and `options`
 * defaults below are a reasonable enough balance.
 */
class DebounceRender extends react_1.Component {
    constructor(props) {
        var _a, _b;
        super(props);
        this.updateDebounced = (0, debounce_1.default)(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.forceUpdate, (_a = props.wait) !== null && _a !== void 0 ? _a : 170, (_b = props.options) !== null && _b !== void 0 ? _b : {
            leading: true,
            trailing: true,
            maxWait: 300,
        });
    }
    shouldComponentUpdate() {
        this.updateDebounced();
        return false;
    }
    componentWillUnmount() {
        this.updateDebounced.cancel();
    }
    render() {
        return this.props.children;
    }
}
exports.default = DebounceRender;

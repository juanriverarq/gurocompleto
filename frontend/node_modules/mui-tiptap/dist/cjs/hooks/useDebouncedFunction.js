"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debounce_1 = __importDefault(require("lodash/debounce"));
const react_1 = require("react");
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
/**
 * A hook for creating a stable debounced version of the given function.
 *
 * The approach here ensures we use a `ref` for the `func`, with a stable return
 * value, somewhat similar to
 * https://www.developerway.com/posts/debouncing-in-react. It also provides
 * effectively the same API as the lodash function itself.
 *
 * @param func The function to debounce.
 * @param wait ms to wait between calls.
 * @param options lodash debounce options.
 * @returns debounced version of `func`.
 */
function useDebouncedFunction(func, wait, options) {
    const funcRef = (0, react_1.useRef)(func);
    (0, react_1.useEffect)(() => {
        funcRef.current = func;
    }, [func]);
    const debouncedCallback = (0, react_1.useMemo)(() => {
        const funcWrapped = (...args) => { var _a; return (_a = funcRef.current) === null || _a === void 0 ? void 0 : _a.call(funcRef, ...args); };
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
        return (0, debounce_1.default)(funcWrapped, wait, Object.assign(Object.assign(Object.assign({}, ((options === null || options === void 0 ? void 0 : options.leading) !== undefined && { leading: options.leading })), ((options === null || options === void 0 ? void 0 : options.maxWait) !== undefined && { maxWait: options.maxWait })), ((options === null || options === void 0 ? void 0 : options.trailing) !== undefined && { trailing: options.trailing })));
    }, [wait, options === null || options === void 0 ? void 0 : options.leading, options === null || options === void 0 ? void 0 : options.maxWait, options === null || options === void 0 ? void 0 : options.trailing]);
    // When we unmount or the user changes the debouncing wait/options, we'll cancel past
    // invocations
    (0, react_1.useEffect)(() => () => {
        debouncedCallback.cancel();
    }, [debouncedCallback]);
    return debouncedCallback;
}
exports.default = useDebouncedFunction;

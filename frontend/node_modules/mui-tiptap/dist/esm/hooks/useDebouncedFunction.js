import debounce from "lodash/debounce";
import { useEffect, useMemo, useRef } from "react";
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
export default function useDebouncedFunction(func, wait, options) {
    const funcRef = useRef(func);
    useEffect(() => {
        funcRef.current = func;
    }, [func]);
    const debouncedCallback = useMemo(() => {
        const funcWrapped = (...args) => { var _a; return (_a = funcRef.current) === null || _a === void 0 ? void 0 : _a.call(funcRef, ...args); };
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
        return debounce(funcWrapped, wait, {
            // We have to refer to each of the `options` individually in order to ensure our
            // useMemo dependencies are correctly/explicit, satisfying the rules of hooks. We
            // don't want to use the `options` object in the dependency array, since it's
            // likely to be a new object on each render.
            ...((options === null || options === void 0 ? void 0 : options.leading) !== undefined && { leading: options.leading }),
            ...((options === null || options === void 0 ? void 0 : options.maxWait) !== undefined && { maxWait: options.maxWait }),
            ...((options === null || options === void 0 ? void 0 : options.trailing) !== undefined && { trailing: options.trailing }),
        });
    }, [wait, options === null || options === void 0 ? void 0 : options.leading, options === null || options === void 0 ? void 0 : options.maxWait, options === null || options === void 0 ? void 0 : options.trailing]);
    // When we unmount or the user changes the debouncing wait/options, we'll cancel past
    // invocations
    useEffect(() => () => {
        debouncedCallback.cancel();
    }, [debouncedCallback]);
    return debouncedCallback;
}

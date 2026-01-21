import type { DebouncedFunc, DebounceSettings } from "lodash";
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
export default function useDebouncedFunction<T extends (...args: any) => any>(func: T | undefined, wait: number, options?: DebounceSettings): DebouncedFunc<T>;

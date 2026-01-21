"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
/** When the given key is pressed down, execute the given callback. */
function useKeyDown(key, callback) {
    // Use a ref in case `callback` isn't memoized
    const callbackRef = (0, react_1.useRef)(callback);
    (0, react_1.useEffect)(() => {
        callbackRef.current = callback;
    }, [callback]);
    (0, react_1.useEffect)(() => {
        function handleKeyDown(event) {
            if (key === event.key) {
                callbackRef.current(event);
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [key]);
}
exports.default = useKeyDown;

/**
 * Return true if the user is using a Mac (as opposed to Windows, etc.) device.
 */
export declare function isMac(): boolean;
/**
 * Return a human-readable version of which modifier key should be used for
 * keyboard shortcuts depending on Mac vs non-Mac platforms. Useful for visually
 * indicating which key to press.
 */
export declare function getModShortcutKey(): string;
/** Return true if the user is using a touch-based device. */
export declare function isTouchDevice(): boolean;

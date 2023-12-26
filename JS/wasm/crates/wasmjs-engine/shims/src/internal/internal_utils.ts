
export function normalizeEncoding(enc?: string) : string | undefined {
    if (enc == null ||
        enc === "utf8" ||
        enc === "utf-8" ||
        enc === "UTF8" ||
        enc === "UTF-8") return "utf8";
    return slowCases(enc);
}

export function slowCases(enc: string) : string | undefined {
    switch (enc.length) {
        case 4:
            if (enc === "UTF8") return "utf8";
            if (enc === "ucs2" || enc === "UCS2") return "utf16le";
            enc = `${enc}`.toLowerCase();
            if (enc === "utf8") return "utf8";
            if (enc === "ucs2") return "utf16le";
            break;
        case 3:
            if (
                enc === "hex" || enc === "HEX" ||
                `${enc}`.toLowerCase() === "hex"
            ) {
                return "hex";
            }
            break;
        case 5:
            if (enc === "ascii") return "ascii";
            if (enc === "ucs-2") return "utf16le";
            if (enc === "UTF-8") return "utf8";
            if (enc === "ASCII") return "ascii";
            if (enc === "UCS-2") return "utf16le";
            enc = `${enc}`.toLowerCase();
            if (enc === "utf-8") return "utf8";
            if (enc === "ascii") return "ascii";
            if (enc === "ucs-2") return "utf16le";
            break;
        case 6:
            if (enc === "base64") return "base64";
            if (enc === "latin1" || enc === "binary") return "latin1";
            if (enc === "BASE64") return "base64";
            if (enc === "LATIN1" || enc === "BINARY") return "latin1";
            enc = `${enc}`.toLowerCase();
            if (enc === "base64") return "base64";
            if (enc === "latin1" || enc === "binary") return "latin1";
            break;
        case 7:
            if (
                enc === "utf16le" || enc === "UTF16LE" ||
                `${enc}`.toLowerCase() === "utf16le"
            ) {
                return "utf16le";
            }
            break;
        case 8:
            if (
                enc === "utf-16le" || enc === "UTF-16LE" ||
                `${enc}`.toLowerCase() === "utf-16le"
            ) {
                return "utf16le";
            }
            break;
        case 9:
            if (
                enc === "base64url" || enc === "BASE64URL" ||
                `${enc}`.toLowerCase() === "base64url"
            ) {
                return "base64url";
            }
            break;
        default:
            if (enc === "") return "utf8";
    }
    return undefined;
}

export function spliceOne(list: (string|undefined)[], index: number) {
    for (; index + 1 < list.length; index++) list[index] = list[index + 1];
    list.pop();
}

export const ALL_PROPERTIES = 0;
export const ONLY_WRITABLE = 1;
export const ONLY_ENUMERABLE = 2;
export const ONLY_CONFIGURABLE = 4;
export const ONLY_ENUM_WRITABLE = 6;
export const SKIP_STRINGS = 8;
export const SKIP_SYMBOLS = 16;

const isNumericLookup: Record<string, boolean> = {};
export function isArrayIndex(value: unknown): value is number | string {
    switch (typeof value) {
        case "number":
            return value >= 0 && (value | 0) === value;
        case "string": {
            const result = isNumericLookup[value];
            if (result !== void 0) {
                return result;
            }
            const length = value.length;
            if (length === 0) {
                return isNumericLookup[value] = false;
            }
            let ch = 0;
            let i = 0;
            for (; i < length; ++i) {
                ch = value.charCodeAt(i);
                if (
                    i === 0 && ch === 0x30 && length > 1 /* must not start with 0 */ ||
                    ch < 0x30 /* 0 */ || ch > 0x39 /* 9 */
                ) {
                    return isNumericLookup[value] = false;
                }
            }
            return isNumericLookup[value] = true;
        }
        default:
            return false;
    }
}

export function getOwnNonIndexProperties(
    // deno-lint-ignore ban-types
    obj: object,
    filter: number,
): (string | symbol)[] {
    let allProperties = [
        ...Object.getOwnPropertyNames(obj),
        ...Object.getOwnPropertySymbols(obj),
    ];

    if (Array.isArray(obj)) {
        allProperties = allProperties.filter((k) => !isArrayIndex(k));
    }

    if (filter === ALL_PROPERTIES) {
        return allProperties;
    }

    const result: (string | symbol)[] = [];
    for (const key of allProperties) {
        const desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc === undefined) {
            continue;
        }
        if (filter & ONLY_WRITABLE && !desc.writable) {
            continue;
        }
        if (filter & ONLY_ENUMERABLE && !desc.enumerable) {
            continue;
        }
        if (filter & ONLY_CONFIGURABLE && !desc.configurable) {
            continue;
        }
        if (filter & SKIP_STRINGS && typeof key === "string") {
            continue;
        }
        if (filter & SKIP_SYMBOLS && typeof key === "symbol") {
            continue;
        }
        result.push(key);
    }
    return result;
}

export function createDeferredPromise() {
    let resolve;
    let reject;

    // eslint-disable-next-line promise/param-names
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    })
    return {
        promise,
        resolve,
        reject,
    };
}


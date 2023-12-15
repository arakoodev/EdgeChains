import { ALL_PROPERTIES as A_PROPERTIES, ONLY_CONFIGURABLE, ONLY_ENUMERABLE as O_ENUMERABLE, ONLY_WRITABLE, SKIP_STRINGS, SKIP_SYMBOLS, isArrayIndex } from "./internal_utils";

export const kPending = 0;
export const kFulfilled= 1;
export const kRejected = 2;

export const kResourceTypeInspect: unique symbol = Symbol.for("nodejs.util.inspect.custom");

export interface PromiseDetails {
    state: typeof kPending | typeof kFulfilled | typeof kRejected;
    result: unknown;
}

export type TypedArray =
    | Uint8Array
    | Uint8ClampedArray
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | BigUint64Array
    | BigInt64Array
    | Float32Array
    | Float64Array;

export interface PreviewedEntries {
    entries: unknown[];
    isKeyValue: boolean;
}
export interface ProxyDetails {
    target: unknown;
    handler: unknown;
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

    if (filter === A_PROPERTIES) {
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
        if (filter & O_ENUMERABLE && !desc.enumerable) {
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

export const ALL_PROPERTIES = A_PROPERTIES;
export const ONLY_ENUMERABLE = O_ENUMERABLE;

// TODO: implement this properly
export function isArrayBufferView(value: unknown): value is ArrayBufferView {
    return false;
}

export function isArgumentsObject(value: unknown): value is IArguments {
    return false;
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
    return false;
}

export function isAsyncFunction(value: unknown): value is Function {
    return false;
}

export function isBigInt64Array(value: unknown): value is BigInt64Array {
    return false;
}

export function isBigIntObject(value: unknown): value is BigInt {
    return false;
}

export function isBigUint64Array(value: unknown): value is BigUint64Array {
    return false;
}

export function isBooleanObject(value: unknown): value is Boolean {
    return false;
}

export function isDataView(value: unknown): value is DataView {
    return false;
}

export function isDate(value: unknown): value is Date {
    return false;
}

export function isFloat32Array(value: unknown): value is Float32Array {
    return false;
}

export function isFloat64Array(value: unknown): value is Float64Array {
    return false;
}

export function isGeneratorFunction(value: unknown): value is GeneratorFunction {
    return false;
}

export function isGeneratorObject(value: unknown): value is Generator {
    return false;
}

export function isInt8Array(value: unknown): value is Int8Array {
    return false;
}

export function isInt16Array(value: unknown): value is Int16Array {
    return false;
}

export function isInt32Array(value: unknown): value is Int32Array {
    return false;
}

export function isMap(value: unknown): value is Map<unknown, unknown> {
    return false;
}

export function isMapIterator(value: unknown): value is IterableIterator<unknown> {
    return false;
}

export function isModuleNamespaceObject(value: unknown): boolean {
    return false;
}

export function isNativeError(value: unknown): value is Error {
    return false;
}

export function isNumberObject(value: unknown): value is Number {
    return false;
}

export function isPromise(value: unknown): value is Promise<unknown> {
    return false;
}

export function isProxy(value: unknown): boolean {
    return false;
}

export function isRegExp(value: unknown): value is RegExp {
    return false;
}

export function isSet(value: unknown): value is Set<unknown> {
    return false;
}

export function isSetIterator(value: unknown): value is IterableIterator<unknown> {
    return false;
}

export function isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer {
    return false;
}

export function isStringObject(value: unknown): value is String {
    return false;
}

export function isSymbolObject(value: unknown): value is Symbol {
    return false;
}

export function isTypedArray(value: unknown): value is TypedArray {
    return false;
}

export function isUint8Array(value: unknown): value is Uint8Array {
    return false;
}

export function isUint8ClampedArray(value: unknown): value is Uint8ClampedArray {
    return false;
}

export function isUint16Array(value: unknown): value is Uint16Array {
    return false;
}

export function isUint32Array(value: unknown): value is Uint32Array {
    return false;
}

export function isWeakMap(value: unknown): value is WeakMap<any, unknown> {
    return false;
}

export function isWeakSet(value: unknown): value is WeakSet<any> {
    return false;
}

export function isAnyArrayBuffer(value: unknown): value is ArrayBuffer | SharedArrayBuffer {
    return false;
}

export function isBoxedPrimitive(value: unknown): value is Number | String | Boolean | BigInt | Symbol {
    return false;
}


export function getPromiseDetails(value: unknown): PromiseDetails | undefined {
    return undefined
}

export function getProxyDetails(value: unknown): ProxyDetails | undefined {
    return undefined
}

export function previewEntries(value: unknown): PreviewedEntries | undefined {
    return undefined;
}

export function getConstructorName(value: unknown): string {
    return "";
}


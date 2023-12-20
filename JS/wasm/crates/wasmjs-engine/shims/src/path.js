import { posix, win32 } from "./internal/internal_path";

const {
    resolve,
    normalize,
    isAbsolute,
    join,
    relative,
    toNamespacedPath,
    dirname,
    basename,
    extname,
    format,
    parse,
    sep,
    delimiter,
} = posix;

export {
    resolve,
    normalize,
    isAbsolute,
    join,
    relative,
    toNamespacedPath,
    dirname,
    basename,
    extname,
    format,
    parse,
    sep,
    delimiter,
    posix,
    win32,
};

export { default } from "./internal/internal_path";
import process from "./internal/process";

globalThis.process = process;

globalThis.path = {
    resolve,
    normalize,
    isAbsolute,
    join,
    relative,
    toNamespacedPath,
    dirname,
    basename,
    extname,
    format,
    parse,
    sep,
    delimiter,
    posix,
    win32,
};

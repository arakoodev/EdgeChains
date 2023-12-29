/* eslint-disable */

"use strict";

import * as cryptoImpl from "./crypto";

import { validateFunction, validateInteger, validateString } from "./validators";

import { KeyObject } from "./crypto_keys";

type ArrayLike = cryptoImpl.ArrayLike;

import { kMaxLength } from "./internal_buffer";

import { toBuf, validateByteSource } from "./crypto_util";

import { isAnyArrayBuffer, isArrayBufferView } from "./internal_types";

import { NodeError, ERR_INVALID_ARG_TYPE, ERR_OUT_OF_RANGE } from "./internal_errors";

function validateParameters(
    hash: string,
    key: ArrayLike | KeyObject,
    salt: ArrayLike,
    info: ArrayLike,
    length: number
) {
    // TODO(soon): Add support for KeyObject input.
    if (key instanceof KeyObject) {
        throw new NodeError(
            "ERR_METHOD_NOT_IMPLEMENTED",
            "KeyObject support for hkdf() and " +
                "hkdfSync() is not yet implemented. Use ArrayBuffer, TypedArray, " +
                "DataView, or Buffer instead."
        );
    }

    validateString(hash, "digest");
    key = prepareKey(key as unknown as ArrayLike);
    salt = validateByteSource(salt, "salt");
    info = validateByteSource(info, "info");

    validateInteger(length, "length", 0, kMaxLength);

    if (info.byteLength > 1024) {
        throw new ERR_OUT_OF_RANGE(
            "info",
            "must not contain more than 1024 bytes",
            info.byteLength
        );
    }

    return {
        hash,
        key,
        salt,
        info,
        length,
    };
}

function prepareKey(key: ArrayLike): ArrayLike {
    key = toBuf(key);

    if (!isAnyArrayBuffer(key) && !isArrayBufferView(key)) {
        throw new ERR_INVALID_ARG_TYPE(
            "ikm",
            ["string", "SecretKeyObject", "ArrayBuffer", "TypedArray", "DataView", "Buffer"],
            key
        );
    }

    return key;
}

export function hkdf(
    hash: string,
    key: ArrayLike | KeyObject,
    salt: ArrayLike,
    info: ArrayLike,
    length: number,
    callback: (err: Error | null, derivedKey?: ArrayBuffer) => void
): void {
    ({ hash, key, salt, info, length } = validateParameters(hash, key, salt, info, length));

    validateFunction(callback, "callback");

    new Promise<ArrayBuffer>((res, rej) => {
        try {
            res(cryptoImpl.getHkdf(hash, key as ArrayLike, salt, info, length));
        } catch (err) {
            rej(err);
        }
    }).then(
        (val: ArrayBuffer) => callback(null, val),
        (err) => callback(err)
    );
}

export function hkdfSync(
    hash: string,
    key: ArrayLike | KeyObject,
    salt: ArrayLike,
    info: ArrayLike,
    length: number
): ArrayBuffer {
    ({ hash, key, salt, info, length } = validateParameters(hash, key, salt, info, length));

    return cryptoImpl.getHkdf(hash, key, salt, info, length);
}

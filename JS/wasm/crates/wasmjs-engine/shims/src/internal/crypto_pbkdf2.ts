/* eslint-disable */

"use strict";

import * as cryptoImpl from "./crypto";
type ArrayLike = cryptoImpl.ArrayLike;
export { ArrayLike };

import { Buffer } from "./internal_buffer";

import { validateInt32, validateFunction, validateString } from "./validators";

import { getArrayBufferOrView } from "./crypto_util";

export function pbkdf2Sync(
    password: ArrayLike,
    salt: ArrayLike,
    iterations: number,
    keylen: number,
    digest: string
): Buffer {
    ({ password, salt, iterations, keylen, digest } = check(
        password,
        salt,
        iterations,
        keylen,
        digest
    ));

    const result = cryptoImpl.getPbkdf(password, salt, iterations, keylen, digest);
    return Buffer.from(result);
}

export type Pbkdf2Callback = (err?: Error | null, result?: Buffer) => void;
export function pbkdf2(
    password: ArrayLike,
    salt: ArrayLike,
    iterations: number,
    keylen: number,
    digest: string,
    callback: Pbkdf2Callback
): void {
    if (typeof digest === "function") {
        // Appease node test cases
        validateString(undefined, "digest");
    }
    validateFunction(callback, "callback");
    ({ password, salt, iterations, keylen, digest } = check(
        password,
        salt,
        iterations,
        keylen,
        digest
    ));

    new Promise<ArrayBuffer>((res, rej) => {
        try {
            res(cryptoImpl.getPbkdf(password, salt, iterations, keylen, digest));
        } catch (err) {
            rej(err);
        }
    }).then(
        (val) => callback(null, Buffer.from(val)),
        (err) => callback(err)
    );
}

function check(
    password: ArrayLike | ArrayBufferView,
    salt: ArrayLike | ArrayBufferView,
    iterations: number,
    keylen: number,
    digest: string
): any {
    validateString(digest, "digest");

    password = getArrayBufferOrView(password, "password");
    salt = getArrayBufferOrView(salt, "salt");
    // OpenSSL uses a signed int to represent these values, so we are restricted
    // to the 31-bit range here (which is plenty).
    validateInt32(iterations, "iterations", 1);
    validateInt32(keylen, "keylen", 0);

    return { password, salt, iterations, keylen, digest };
}

/* eslint-disable */

"use strict";

import { Buffer } from "./internal_buffer";

import * as cryptoImpl from "./crypto";
type ArrayLike = cryptoImpl.ArrayLike;

import { ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY, ERR_INVALID_ARG_TYPE } from "./internal_errors";

import { validateInt32 } from "./validators";

import { isArrayBufferView, isAnyArrayBuffer } from "./internal_types";

import { getArrayBufferOrView, toBuf, kHandle } from "./crypto_util";

const DH_GENERATOR = 2;

interface DiffieHellman {
    [kHandle]: cryptoImpl.DiffieHellmanHandle;
}

let DiffieHellman = function (
    this: DiffieHellman,
    sizeOrKey: number | ArrayLike,
    keyEncoding?: number | string,
    generator?: number | ArrayLike,
    genEncoding?: string
): DiffieHellman {
    if (!(this instanceof DiffieHellman))
        return new DiffieHellman(sizeOrKey, keyEncoding, generator, genEncoding);
    if (
        typeof sizeOrKey !== "number" &&
        typeof sizeOrKey !== "string" &&
        !isArrayBufferView(sizeOrKey) &&
        !isAnyArrayBuffer(sizeOrKey)
    ) {
        throw new ERR_INVALID_ARG_TYPE(
            "sizeOrKey",
            ["number", "string", "ArrayBuffer", "Buffer", "TypedArray", "DataView"],
            sizeOrKey
        );
    }

    // Sizes < 0 don't make sense but they _are_ accepted (and subsequently
    // rejected with ERR_OSSL_BN_BITS_TOO_SMALL) by OpenSSL. The glue code
    // in node_crypto.cc accepts values that are IsInt32() for that reason
    // and that's why we do that here too.
    if (typeof sizeOrKey === "number") validateInt32(sizeOrKey, "sizeOrKey");

    if (keyEncoding && !Buffer.isEncoding(keyEncoding) && keyEncoding !== "buffer") {
        genEncoding = generator as any;
        generator = keyEncoding;
        keyEncoding = "utf-8"; // default encoding
    }

    keyEncoding ??= "utf-8";
    genEncoding ??= "utf-8";

    if (typeof sizeOrKey !== "number") sizeOrKey = toBuf(sizeOrKey, keyEncoding as string);

    if (!generator) {
        generator = DH_GENERATOR;
    } else if (typeof generator === "number") {
        validateInt32(generator, "generator");
    } else if (typeof generator === "string") {
        generator = toBuf(generator, genEncoding);
    } else if (!isArrayBufferView(generator) && !isAnyArrayBuffer(generator)) {
        throw new ERR_INVALID_ARG_TYPE(
            "generator",
            ["number", "string", "ArrayBuffer", "Buffer", "TypedArray", "DataView"],
            generator
        );
    }

    this[kHandle] = new cryptoImpl.DiffieHellmanHandle(sizeOrKey as any, generator as any);
    Object.defineProperty(DiffieHellman.prototype, "verifyError", {
        get: function () {
            return this[kHandle].getVerifyError();
        },
        configurable: true,
        enumerable: true,
    });
    return this;
} as any as {
    new (
        sizeOrKey: number | ArrayLike,
        keyEncoding?: number | string,
        generator?: number | ArrayLike,
        genEncoding?: string
    ): DiffieHellman;
};

interface DiffieHellmanGroup {
    [kHandle]: cryptoImpl.DiffieHellmanHandle;
}

let DiffieHellmanGroup = function (this: DiffieHellmanGroup, name: string): DiffieHellmanGroup {
    if (!(this instanceof DiffieHellmanGroup)) return new DiffieHellmanGroup(name);

    // The C++-based handle is shared between both classes, so DiffieHellmanGroupHandle() is merely
    // a different constructor for a DiffieHellmanHandle.
    this[kHandle] = cryptoImpl.DiffieHellmanGroupHandle(name);
    Object.defineProperty(DiffieHellmanGroup.prototype, "verifyError", {
        get: function () {
            return this[kHandle].getVerifyError();
        },
        configurable: true,
        enumerable: true,
    });
    return this;
} as any as { new (name: string): DiffieHellmanGroup };

DiffieHellmanGroup.prototype.generateKeys = DiffieHellman.prototype.generateKeys = dhGenerateKeys;
DiffieHellmanGroup.prototype.computeSecret = DiffieHellman.prototype.computeSecret =
    dhComputeSecret;
DiffieHellmanGroup.prototype.getPrime = DiffieHellman.prototype.getPrime = dhGetPrime;
DiffieHellmanGroup.prototype.getGenerator = DiffieHellman.prototype.getGenerator = dhGetGenerator;
DiffieHellmanGroup.prototype.getPublicKey = DiffieHellman.prototype.getPublicKey = dhGetPublicKey;
DiffieHellmanGroup.prototype.getPrivateKey = DiffieHellman.prototype.getPrivateKey =
    dhGetPrivateKey;
DiffieHellman.prototype.setPublicKey = dhSetPublicKey;
DiffieHellman.prototype.setPrivateKey = dhSetPrivateKey;

export { DiffieHellman, DiffieHellmanGroup };

type DHLike = DiffieHellman | DiffieHellmanGroup;
function dhGenerateKeys(this: DHLike, encoding?: string): Buffer | string {
    const keys = this[kHandle].generateKeys();
    return encode(keys, encoding);
}

function dhComputeSecret(
    this: DHLike,
    key: ArrayLike,
    inEnc?: string,
    outEnc?: string
): Buffer | string {
    key = getArrayBufferOrView(key, "key", inEnc);
    const ret = this[kHandle].computeSecret(key);
    if (typeof ret === "string") throw new ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY();
    return encode(ret, outEnc);
}

function dhGetPrime(this: DHLike, encoding?: string): Buffer | string {
    const prime = this[kHandle].getPrime();
    return encode(prime, encoding);
}

function dhGetGenerator(this: DHLike, encoding?: string): Buffer | string {
    const generator = this[kHandle].getGenerator();
    return encode(generator, encoding);
}

function dhGetPublicKey(this: DHLike, encoding?: string): Buffer | string {
    const key = this[kHandle].getPublicKey();
    return encode(key, encoding);
}

function dhGetPrivateKey(this: DHLike, encoding?: string): Buffer | string {
    const key = this[kHandle].getPrivateKey();
    return encode(key, encoding);
}

function dhSetPublicKey(this: DiffieHellman, key: ArrayLike, encoding?: string): DiffieHellman {
    key = getArrayBufferOrView(key, "key", encoding);
    this[kHandle].setPublicKey(key);
    return this;
}

function dhSetPrivateKey(this: DiffieHellman, key: ArrayLike, encoding?: string): DiffieHellman {
    key = getArrayBufferOrView(key, "key", encoding);
    this[kHandle].setPrivateKey(key);
    return this;
}

function encode(buffer: ArrayBuffer, encoding?: string): Buffer | string {
    if (encoding && encoding !== "buffer") return Buffer.from(buffer).toString(encoding);
    return Buffer.from(buffer);
}

export function createDiffieHellman(
    sizeOrKey: number | ArrayLike,
    keyEncoding?: number | string,
    generator?: number | ArrayLike,
    genEncoding?: string
): DiffieHellman {
    return new DiffieHellman(sizeOrKey, keyEncoding, generator, genEncoding);
}

export function createDiffieHellmanGroup(name: string): DiffieHellmanGroup {
    return new DiffieHellmanGroup(name);
}

export function getDiffieHellman(name: string): DiffieHellmanGroup {
    return createDiffieHellmanGroup(name);
}

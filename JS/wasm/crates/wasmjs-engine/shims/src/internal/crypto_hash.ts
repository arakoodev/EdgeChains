/* eslint-disable */

import * as cryptoImpl from './crypto';
type ArrayLike = cryptoImpl.ArrayLike;

import {
  kFinalized,
  kHandle,
  kState,
  getArrayBufferOrView,
  getStringOption,
} from './crypto_util';

import {
  Buffer
} from './internal_buffer';

import {
  ERR_CRYPTO_HASH_FINALIZED,
  ERR_CRYPTO_HASH_UPDATE_FAILED,
  ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE,
  ERR_INVALID_ARG_TYPE,
} from './internal_errors';

import {
  validateEncoding,
  validateString,
  validateUint32,
} from './validators';

import {
  normalizeEncoding
} from './internal_utils';

import {
  isArrayBufferView,
  isCryptoKey,
  isAnyArrayBuffer,
} from './internal_types';

import {
  Transform,
  TransformOptions,
  TransformCallback,
} from './streams_transform';

import {
  KeyObject,
} from './crypto_keys';

export interface HashOptions extends TransformOptions {
  outputLength?: number;
}

interface _kState {
  [kFinalized]: boolean;
}

interface Hash extends Transform {
  [kHandle]: cryptoImpl.HashHandle;
  [kState]: _kState;
}

// These helper functions are needed because the constructors can
// use new, in which case V8 cannot inline the recursive constructor call
export function createHash(algorithm: string, options?: HashOptions): Hash {
  return new Hash(algorithm, options);
}

let Hash = function(this: Hash, algorithm: string | cryptoImpl.HashHandle,
  options?: HashOptions): Hash {
  if (!(this instanceof Hash))
    return new Hash(algorithm, options);

  const xofLen = typeof options === 'object' ? options.outputLength : undefined;
  if (xofLen !== undefined)
    validateUint32(xofLen, 'options.outputLength');
  if (algorithm instanceof cryptoImpl.HashHandle) {
    this[kHandle] = algorithm.copy(xofLen as number);
  } else {
    validateString(algorithm, 'algorithm');
    this[kHandle] = new cryptoImpl.HashHandle(algorithm, xofLen as number);
  }
  this[kState] = {
    [kFinalized]: false,
  };

  Transform.call(this, options);
  return this;
} as any as { new (algorithm: string | cryptoImpl.HashHandle, options?: HashOptions): Hash; };

Object.setPrototypeOf(Hash.prototype, Transform.prototype);
Object.setPrototypeOf(Hash, Transform);

Hash.prototype.copy = function(this: Hash, options?: HashOptions): Hash {
  const state = this[kState];
  if (state[kFinalized])
    throw new ERR_CRYPTO_HASH_FINALIZED();

  return new Hash(this[kHandle], options);
}

Hash.prototype._transform = function(this: Hash | Hmac, chunk: string | Buffer | ArrayBufferView,
                                     encoding: string, callback: TransformCallback): void {
  if (typeof chunk === 'string') {
    encoding ??= 'utf-8';
    validateEncoding(chunk, encoding);
    encoding = normalizeEncoding(encoding)!;
    chunk = Buffer.from(chunk, encoding);
  }
  this[kHandle].update(chunk);
  callback();
}

Hash.prototype._flush = function(this: Hash | Hmac, callback: TransformCallback): void {
  this.push(Buffer.from(this[kHandle].digest()));
  callback();
}

Hash.prototype.update = function(this: Hash | Hmac, data: string | Buffer | ArrayBufferView,
                                 encoding?: string): Hash | Hmac {
  encoding ??= 'utf8';
  if (encoding === 'buffer') {
    encoding = undefined;
  }

  const state = this[kState];
  if (state[kFinalized])
    throw new ERR_CRYPTO_HASH_FINALIZED();

  if (typeof data === 'string') {
    validateEncoding(data, encoding!);
    encoding = normalizeEncoding(encoding);
    data = Buffer.from(data, encoding);
  } else if (!isArrayBufferView(data)) {
    throw new ERR_INVALID_ARG_TYPE(
      'data', ['string', 'Buffer', 'TypedArray', 'DataView'], data);
  }

  if (!this[kHandle].update(data))
    throw new ERR_CRYPTO_HASH_UPDATE_FAILED();
  return this;
}

Hash.prototype.digest = function(this: Hash, outputEncoding?: string): Buffer | string {
  const state = this[kState];
  if (state[kFinalized])
    throw new ERR_CRYPTO_HASH_FINALIZED();

  // Explicit conversion for backward compatibility.
  const ret = Buffer.from(this[kHandle].digest());
  state[kFinalized] = true;
  if (outputEncoding !== undefined && outputEncoding !== 'buffer') {
    return ret.toString(outputEncoding);
  } else {
    return ret;
  }
}

///////////////////////////

interface Hmac extends Transform {
  [kHandle]: cryptoImpl.HmacHandle;
  [kState]: _kState;
}

export function createHmac(hmac: string, key: ArrayLike | KeyObject | CryptoKey,
                           options?: TransformOptions): Hmac {
  return new Hmac(hmac, key, options);
}

let Hmac = function(this: Hmac, hmac: string, key: ArrayLike | KeyObject | cryptoImpl.CryptoKey,
                    options?: TransformOptions): Hmac {
  if (!(this instanceof Hmac)) {
    return new Hmac(hmac, key, options);
  }
  validateString(hmac, 'hmac');
  const encoding = getStringOption(options, 'encoding');

  if (key instanceof KeyObject) {
    if (key.type !== 'secret') {
      throw new ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE(key.type, 'secret');
    }
    this[kHandle] = new cryptoImpl.HmacHandle(hmac, key[kHandle]);
  } else if (isCryptoKey(key)) {
    if ((key as cryptoImpl.CryptoKey).type !== 'secret') {
      throw new ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE((key as cryptoImpl.CryptoKey).type, 'secret');
    }
    this[kHandle] = new cryptoImpl.HmacHandle(hmac, key);
  } else if (typeof key !== 'string' &&
  !isArrayBufferView(key) &&
  !isAnyArrayBuffer(key)) {
    throw new ERR_INVALID_ARG_TYPE(
      'key',
      [ 'ArrayBuffer', 'Buffer', 'ArrayBufferView', 'string', 'KeyObject', 'CryptoKey'],
      key);
  } else {
    this[kHandle] = new cryptoImpl.HmacHandle(hmac, getArrayBufferOrView(key as ArrayLike,
                                              'key', encoding));
  }

  this[kState] = {
    [kFinalized]: false,
  };
  Transform.call(this, options);
  return this;
} as any as { new (hmac: string, key: ArrayLike | KeyObject | CryptoKey,
                   options?: TransformOptions): Hmac; };

Object.setPrototypeOf(Hmac.prototype, Transform.prototype);
Object.setPrototypeOf(Hmac, Transform);

Hmac.prototype.update = Hash.prototype.update;

Hmac.prototype.digest = function(this: Hmac, outputEncoding?: string): Buffer | string {
  const state = this[kState];
  if (state[kFinalized]) {
    const buf = Buffer.from('');
    return outputEncoding === 'buffer' ? buf : buf.toString(outputEncoding);
  }

  // Explicit conversion for backward compatibility.
  const ret = Buffer.from(this[kHandle].digest());
  state[kFinalized] = true;
  if (outputEncoding !== undefined && outputEncoding !== 'buffer') {
    return ret.toString(outputEncoding);
  } else {
    return ret;
  }
};

Hmac.prototype._flush = Hash.prototype._flush;
Hmac.prototype._transform = Hash.prototype._transform;

export {Hash, Hmac};

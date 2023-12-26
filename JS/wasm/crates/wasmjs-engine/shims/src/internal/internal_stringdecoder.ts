
import { Buffer, isEncoding } from './internal_buffer';
import { normalizeEncoding } from './internal_utils';
import {
  ERR_INVALID_ARG_TYPE,
  ERR_INVALID_THIS,
  ERR_UNKNOWN_ENCODING,
} from './internal_errors';

import * as bufferUtil from './buffer';

const kIncompleteCharactersStart = 0;
const kIncompleteCharactersEnd = 4;
const kMissingBytes = 4;
const kBufferedBytes = 5;
const kEncoding = 6;
const kSize = 7;

const encodings : Record<string,number> = {
  ascii: 0,
  latin1: 1,
  utf8: 2,
  utf16le: 3,
  base64: 4,
  base64url: 5,
  hex: 6,
};

const kNativeDecoder = Symbol('kNativeDecoder');

export interface StringDecoder {
  encoding: string;
  readonly lastChar: Uint8Array;
  readonly lastNeed: number;
  readonly lastTotal: number;
  new (encoding? : string): StringDecoder;
  write(buf: ArrayBufferView|DataView|string): string;
  end(buf?: ArrayBufferView|DataView|string): string;
  text(buf: ArrayBufferView|DataView|string, offset?: number): string;
  new (encoding?: string): StringDecoder;
}

interface InternalDecoder extends StringDecoder {
  [kNativeDecoder]: Buffer;
}

export function StringDecoder(this: StringDecoder, encoding: string = 'utf8') {
  const normalizedEncoding = normalizeEncoding(encoding);
  if (!isEncoding(normalizedEncoding)) {
    throw new ERR_UNKNOWN_ENCODING(encoding);
  }
  (this as InternalDecoder)[kNativeDecoder] = Buffer.alloc(kSize);
  (this as InternalDecoder)[kNativeDecoder][kEncoding] = encodings[normalizedEncoding!]!;
  this.encoding = normalizedEncoding!;
}

function write(this: StringDecoder, buf: ArrayBufferView|DataView|string): string {
  if ((this as InternalDecoder)[kNativeDecoder] === undefined) {
    throw new ERR_INVALID_THIS('StringDecoder');
  }
  if (typeof buf === 'string') {
    return buf;
  }
  if (!ArrayBuffer.isView(buf)) {
    throw new ERR_INVALID_ARG_TYPE('buf', [
      'Buffer', 'TypedArray', 'DataView', 'string'
    ], buf);
  }
  const buffer = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return bufferUtil.decode(buffer, (this as InternalDecoder)[kNativeDecoder]);
}

function end(this: StringDecoder, buf?: ArrayBufferView|DataView|string): string {
  if ((this as InternalDecoder)[kNativeDecoder] === undefined) {
    throw new ERR_INVALID_THIS('StringDecoder');
  }
  let ret = '';
  if (buf !== undefined) {
    ret = this.write(buf);
  }
  if ((this as InternalDecoder)[kNativeDecoder][kBufferedBytes]! > 0) {
    ret += bufferUtil.flush((this as InternalDecoder)[kNativeDecoder]);
  }
  return ret;
}

function text(this: StringDecoder, buf: ArrayBufferView|DataView|string, offset?: number) : string {
  if ((this as InternalDecoder)[kNativeDecoder] === undefined) {
    throw new ERR_INVALID_THIS('StringDecoder');
  }
  (this as InternalDecoder)[kNativeDecoder][kMissingBytes] = 0;
  (this as InternalDecoder)[kNativeDecoder][kBufferedBytes] = 0;
  return this.write((buf as any).slice(offset));
}

StringDecoder.prototype.write = write;
StringDecoder.prototype.end = end;
StringDecoder.prototype.text = text;

Object.defineProperties(StringDecoder.prototype, {
  lastChar: {
    enumerable: true,
    get(this: StringDecoder) : Buffer {
      if ((this as InternalDecoder)[kNativeDecoder] === undefined) {
        throw new ERR_INVALID_THIS('StringDecoder');
      }
      return (this as InternalDecoder)[kNativeDecoder].subarray(
        kIncompleteCharactersStart, kIncompleteCharactersEnd) as Buffer;
    },
  },
  lastNeed: {
    enumerable: true,
    get(this: StringDecoder) : number {
      if ((this as InternalDecoder)[kNativeDecoder] === undefined) {
        throw new ERR_INVALID_THIS('StringDecoder');
      }
      return (this as InternalDecoder)[kNativeDecoder][kMissingBytes]!;
    },
  },
  lastTotal: {
    enumerable: true,
    get(this: StringDecoder) : number {
      if ((this as InternalDecoder)[kNativeDecoder] === undefined) {
        throw new ERR_INVALID_THIS('StringDecoder');
      }
      return (this as InternalDecoder)[kNativeDecoder][kBufferedBytes]! +
        (this as InternalDecoder)[kNativeDecoder][kMissingBytes]!;
    },
  },
});

export default {
  StringDecoder
};

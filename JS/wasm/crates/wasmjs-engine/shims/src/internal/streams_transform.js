"use strict";

import { ERR_METHOD_NOT_IMPLEMENTED } from "./internal_errors";

import { Duplex } from "./streams_duplex";

import { getHighWaterMark } from "./streams_util";

Object.setPrototypeOf(Transform.prototype, Duplex.prototype);
Object.setPrototypeOf(Transform, Duplex);

const kCallback = Symbol("kCallback");

export function Transform(options) {
    if (!(this instanceof Transform)) return new Transform(options);

    // TODO (ronag): This should preferably always be
    // applied but would be semver-major. Or even better;
    // make Transform a Readable with the Writable interface.
    const readableHighWaterMark = options
        ? getHighWaterMark(options, "readableHighWaterMark", true)
        : null;
    if (readableHighWaterMark === 0) {
        // A Duplex will buffer both on the writable and readable side while
        // a Transform just wants to buffer hwm number of elements. To avoid
        // buffering twice we disable buffering on the writable side.
        options = {
            ...options,
            highWaterMark: null,
            readableHighWaterMark,
            // TODO (ronag): 0 is not optimal since we have
            // a "bug" where we check needDrain before calling _write and not after.
            // Refs: https://github.com/nodejs/node/pull/32887
            // Refs: https://github.com/nodejs/node/pull/35941
            writableHighWaterMark: options?.writableHighWaterMark || 0,
        };
    }
    Duplex.call(this, options);

    // We have implemented the _read method, and done the other things
    // that Readable wants before the first _read call, so unset the
    // sync guard flag.
    this._readableState.sync = false;
    this[kCallback] = null;
    if (options) {
        if (typeof options.transform === "function") this._transform = options.transform;
        if (typeof options.flush === "function") this._flush = options.flush;
    }

    // When the writable side finishes, then flush out anything remaining.
    // Backwards compat. Some Transform streams incorrectly implement _final
    // instead of or in addition to _flush. By using 'prefinish' instead of
    // implementing _final we continue supporting this unfortunate use case.
    this.on("prefinish", prefinish);
}

function final(cb) {
    if (typeof this._flush === "function" && !this.destroyed) {
        this._flush((er, data) => {
            if (er) {
                if (cb) {
                    cb(er);
                } else {
                    this.destroy(er);
                }
                return;
            }
            if (data != null) {
                this.push(data);
            }
            this.push(null);
            if (cb) {
                cb();
            }
        });
    } else {
        this.push(null);
        if (cb) {
            cb();
        }
    }
}

function prefinish() {
    if (this._final !== final) {
        final.call(this);
    }
}
Transform.prototype._final = final;

Transform.prototype._transform = function () {
    throw new ERR_METHOD_NOT_IMPLEMENTED("_transform()");
};

Transform.prototype._write = function (chunk, encoding, callback) {
    const rState = this._readableState;
    const wState = this._writableState;
    const length = rState.length;
    this._transform(chunk, encoding, (err, val) => {
        if (err) {
            callback(err);
            return;
        }
        if (val != null) {
            this.push(val);
        }
        if (
            wState.ended ||
            // Backwards compat.
            length === rState.length ||
            // Backwards compat.
            rState.length < rState.highWaterMark
        ) {
            callback();
        } else {
            this[kCallback] = callback;
        }
    });
};

Transform.prototype._read = function (_size) {
    if (this[kCallback]) {
        const callback = this[kCallback];
        this[kCallback] = null;
        callback();
    }
};

Object.setPrototypeOf(PassThrough.prototype, Transform.prototype);
Object.setPrototypeOf(PassThrough, Transform);

export function PassThrough(options) {
    if (!(this instanceof PassThrough)) return new PassThrough(options);
    Transform.call(this, {
        ...options,
        transform: undefined,
        flush: undefined,
    });
}

PassThrough.prototype._transform = function (chunk, _, cb) {
    cb(null, chunk);
};

import EventEmitter from "./events";

import { Buffer } from "./internal_buffer";

export function Stream(opts) {
    EventEmitter.call(this, opts || {});
}

Object.setPrototypeOf(Stream.prototype, EventEmitter.prototype);
Object.setPrototypeOf(Stream, EventEmitter);

Stream.prototype.pipe = function (dest, options) {
    const source = this;
    function ondata(chunk) {
        if (dest.writable && dest.write(chunk) === false && source.pause) {
            source.pause();
        }
    }
    source.on("data", ondata);
    function ondrain() {
        if (source.readable && source.resume) {
            source.resume();
        }
    }
    dest.on("drain", ondrain);

    // If the 'end' option is not supplied, dest.end() will be called when
    // source gets the 'end' or 'close' events.  Only dest.end() once.
    if (!dest._isStdio && (!options || options.end !== false)) {
        source.on("end", onend);
        source.on("close", onclose);
    }
    let didOnEnd = false;
    function onend() {
        if (didOnEnd) return;
        didOnEnd = true;
        dest.end();
    }
    function onclose() {
        if (didOnEnd) return;
        didOnEnd = true;
        if (typeof dest.destroy === "function") dest.destroy();
    }

    // Don't leave dangling pipes when there are errors.
    function onerror(er) {
        cleanup();
        if (EventEmitter.listenerCount(this, "error") === 0) {
            this.emit("error", er);
        }
    }
    source.prependListener("error", onerror);
    dest.prependListener("error", onerror);

    // Remove all the event listeners that were added.
    function cleanup() {
        source.removeListener("data", ondata);
        dest.removeListener("drain", ondrain);
        source.removeListener("end", onend);
        source.removeListener("close", onclose);
        source.removeListener("error", onerror);
        dest.removeListener("error", onerror);
        source.removeListener("end", cleanup);
        source.removeListener("close", cleanup);
        dest.removeListener("close", cleanup);
    }
    source.on("end", cleanup);
    source.on("close", cleanup);
    dest.on("close", cleanup);
    dest.emit("pipe", source);

    // Allow for unix-like usage: A.pipe(B).pipe(C)
    return dest;
};

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;
Stream._isUint8Array = function isUint8Array(value) {
    return value instanceof Uint8Array;
};
Stream._uint8ArrayToBuffer = function _uint8ArrayToBuffer(chunk) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
};

/*! SPDX-License-Identifier: MIT */
const binding = require('bindings')('node-jsonnet')
const { Jsonnet } = binding;
const isAsyncFunction = require('util').types.isAsyncFunction;

// Workaround: Callback's throwing in ThreadSafeFunction kills Node VM.
// Wrapping in async function can prevent it.

const _nativeCallback = Jsonnet.prototype._nativeCallback;
Jsonnet.prototype.nativeCallback = function(name, func, ...params) {
  const asyncFunc = isAsyncFunction(func)
        ? func
        : async function(...args) { return func.call(this, ...args); }

  return _nativeCallback.call(this, name, asyncFunc, ...params);
}

class JsonnetError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
}

Object.defineProperty(binding, 'JsonnetError', { value: JsonnetError });

module.exports = binding;

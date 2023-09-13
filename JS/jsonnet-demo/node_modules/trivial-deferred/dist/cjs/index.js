"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deferred = void 0;
/**
 * A handle around a Promise, so it may be resolved or
 * rejected from outside the Promise constructor.
 */
class Deferred {
    constructor() {
        /**
         * The promise that gets resolved or rejected
         */
        this.promise = new Promise((res, rej) => {
            this.resolve = res;
            this.reject = rej;
        });
    }
    /**
     * static reference to the class, so that
     * require('trivial-deferred').Deferred works
     */
    static get Deferred() {
        return Deferred;
    }
}
exports.Deferred = Deferred;
exports.default = Deferred;
//# sourceMappingURL=index.js.map
/**
 * A handle around a Promise, so it may be resolved or
 * rejected from outside the Promise constructor.
 */
export class Deferred {
    /**
     * Resolve the promise
     */
    resolve;
    /**
     * Reject the promise
     */
    reject;
    /**
     * The promise that gets resolved or rejected
     */
    promise = new Promise((res, rej) => {
        this.resolve = res;
        this.reject = rej;
    });
    /**
     * static reference to the class, so that
     * require('trivial-deferred').Deferred works
     */
    static get Deferred() {
        return Deferred;
    }
}
export default Deferred;
//# sourceMappingURL=index.js.map
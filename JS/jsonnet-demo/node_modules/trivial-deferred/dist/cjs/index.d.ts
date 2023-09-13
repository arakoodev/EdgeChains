/**
 * A handle around a Promise, so it may be resolved or
 * rejected from outside the Promise constructor.
 */
export declare class Deferred<T = unknown> {
    /**
     * Resolve the promise
     */
    resolve: (v: T) => void;
    /**
     * Reject the promise
     */
    reject: (er: any) => void;
    /**
     * The promise that gets resolved or rejected
     */
    promise: Promise<T>;
    /**
     * static reference to the class, so that
     * require('trivial-deferred').Deferred works
     */
    static get Deferred(): typeof Deferred;
}
export default Deferred;
//# sourceMappingURL=index.d.ts.map
export interface AsyncResourceOptions {
    triggerAsyncId?: number;
}

export class AsyncResource {
    // @ts-ignore
    public constructor(type: string, options?: AsyncResourceOptions);
    // @ts-ignore
    public runInAsyncScope<R>(fn: (...args: unknown[]) => R, ...args: unknown[]): R;

    public bind<Func extends (...args: unknown[]) => unknown>(
        fn: Func): Func & { asyncResource: AsyncResource; };

    // @ts-ignore
    public static bind<Func extends (this: ThisArg, ...args: unknown[]) => unknown, ThisArg>(
        fn: Func, type?: string, thisArg?: ThisArg): Func & { asyncResource: AsyncResource; };
}

export class AsyncLocalStorage<T> {
    // @ts-ignore
    public run<R>(store: T, fn: (...args: unknown[]) => R, ...args: unknown[]): R;
    // @ts-ignore
    public exit<R>(fn: (...args: unknown[]) => R, ...args: unknown[]): R;
    // @ts-ignore
    public getStore(): T;
}

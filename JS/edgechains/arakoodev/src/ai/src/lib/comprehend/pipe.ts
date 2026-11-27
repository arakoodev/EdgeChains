export type Operator<T, R> = (value: T) => R | Promise<R>;

/**
 * Promise/async equivalent of the old RxJS `pipe` used by EdgeChains endpoints.
 * Each operator receives the resolved value of the previous step.
 */
export async function pipe<A>(value: A | Promise<A>): Promise<A>;
export async function pipe<A, B>(value: A | Promise<A>, fn1: Operator<A, B>): Promise<B>;
export async function pipe<A, B, C>(
    value: A | Promise<A>,
    fn1: Operator<A, B>,
    fn2: Operator<B, C>
): Promise<C>;
export async function pipe<A, B, C, D>(
    value: A | Promise<A>,
    fn1: Operator<A, B>,
    fn2: Operator<B, C>,
    fn3: Operator<C, D>
): Promise<D>;
export async function pipe<A, B, C, D, E>(
    value: A | Promise<A>,
    fn1: Operator<A, B>,
    fn2: Operator<B, C>,
    fn3: Operator<C, D>,
    fn4: Operator<D, E>
): Promise<E>;
export async function pipe(
    value: unknown,
    ...fns: Array<Operator<unknown, unknown>>
): Promise<unknown> {
    let current = await value;
    for (const fn of fns) {
        current = await fn(current);
    }
    return current;
}

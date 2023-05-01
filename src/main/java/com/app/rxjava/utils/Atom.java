package com.app.rxjava.utils;

import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

/**
 * Simple wrapper over an AtomicReference

 * @param <T> The type of data stored in the atom. This is assumed to be an immutable object.
 */
public final class Atom<T> {
    private final AtomicReference<T> ref;

    private Atom(T data) {
        this.ref = new AtomicReference<>(data);
    }

    /**
     * Creates an atom wrapping the given data.
     * @param data The data to be stored in the atom.
     * @param <T> The type of data stored in the atom. This is assumed to be an immutable object.
     * @return An atom containing the given data.
     */
    public static <T> Atom<T> of(T data) {
        return new Atom<>(data);
    }

    /**
     * Swaps the current value in the atom for the value returned by the function.
     * @param f The function to apply to the current value. It is expected that this
     *          will be a "pure" function and thus may be run multiple times.
     * @return The value in the Atom after the function is applied.
     */
    public T swap(Function<? super T, ? extends T> f) {
        while (true) {
            final var start = ref.get();
            final var res = f.apply(start);
            if (this.ref.compareAndSet(start, res)) {
                return res;
            }
        }
    }

    /**
     * Resets the value in the atom to the given value.
     * @param data The new value to be stored in the atom.
     * @return The new value stored in the atom.
     */
    public T set(T data) {
        this.ref.set(data);
        return data;
    }

    /**
     * @return The atom's current value.
     */
    public T get() {
        return this.ref.get();
    }

//    @Override
//    public String toString() {
//        return "Atom[value=" + this.get() + "]";
//    }
}
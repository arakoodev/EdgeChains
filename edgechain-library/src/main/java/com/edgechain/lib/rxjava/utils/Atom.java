package com.edgechain.lib.rxjava.utils;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Simple wrapper over an AtomicReference
 * @param <T> The type of data stored in the atom. An immutable object.
 */
public final class Atom<T> {
    private final AtomicReference<T> ref;

    private Atom(T data) {
        this.ref = new AtomicReference<>(data);
    }


    public static <T> Atom<T> of(T data) {
        return new Atom<>(data);
    }

    public T set(T data) {
        this.ref.set(data);
        return data;
    }

    public T get() {
        return this.ref.get();
    }

}
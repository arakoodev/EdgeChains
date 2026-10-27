package com.edgechain.lib.rxjava.utils;

import java.io.Serializable;
import java.util.concurrent.atomic.AtomicInteger;

/** Simple wrapper over an AtomicInteger */
public final class AtomInteger implements Serializable {

  private static final long serialVersionUID = 2089141378144025092L;
  private final AtomicInteger ref;

  private AtomInteger(Integer data) {
    this.ref = new AtomicInteger(data);
  }

  public static AtomInteger of(Integer data) {
    return new AtomInteger(data);
  }

  public Integer incrementAndGet() {
    return this.ref.incrementAndGet();
  }

  public Integer getAndIncrement() {
    return this.ref.getAndIncrement();
  }

  public Integer get() {
    return this.ref.get();
  }
}

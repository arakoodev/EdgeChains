package com.edgechain.lib.index.enums;

public enum BaseWeight {
  W1_0(1.0),
  W1_25(1.25),
  W1_5(1.5),
  W1_75(1.75),
  W2_0(2.0),
  W2_25(2.25),
  W2_5(2.5),
  W2_75(2.75),
  W3_0(3.0);

  private final double value;

  BaseWeight(double value) {
    this.value = value;
  }

  public double getValue() {
    return value;
  }

  public static BaseWeight fromDouble(double value) {
    for (BaseWeight baseWeight : BaseWeight.values()) {
      if (baseWeight.getValue() == value) {
        return baseWeight;
      }
    }
    throw new IllegalArgumentException("Invalid BaseWeight value: " + value);
  }
}

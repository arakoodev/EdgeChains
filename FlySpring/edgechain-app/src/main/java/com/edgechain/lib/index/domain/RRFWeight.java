package com.edgechain.lib.index.domain;

import com.edgechain.lib.index.enums.BaseWeight;

import java.util.StringJoiner;

public class RRFWeight {

  private BaseWeight baseWeight = BaseWeight.W1_0;
  private double fineTuneWeight = 0.5;

  public RRFWeight() {}

  public RRFWeight(BaseWeight baseWeight, double fineTuneWeight) {
    this.baseWeight = baseWeight;
    this.fineTuneWeight = fineTuneWeight;

    if (fineTuneWeight < 0 || fineTuneWeight > 1.0)
      throw new IllegalArgumentException("Weights must be between 0 and 1.");
  }

  public void setBaseWeight(BaseWeight baseWeight) {
    this.baseWeight = baseWeight;
  }

  public void setFineTuneWeight(double fineTuneWeight) {
    this.fineTuneWeight = fineTuneWeight;
  }

  public BaseWeight getBaseWeight() {
    return baseWeight;
  }

  public double getFineTuneWeight() {
    return fineTuneWeight;
  }

  @Override
  public String toString() {
    return new StringJoiner(", ", RRFWeight.class.getSimpleName() + "[", "]")
        .add("baseWeight=" + baseWeight)
        .add("fineTuneWeight=" + fineTuneWeight)
        .toString();
  }
}

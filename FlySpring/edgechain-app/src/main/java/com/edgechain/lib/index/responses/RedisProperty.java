package com.edgechain.lib.index.responses;

public class RedisProperty {
  private String id;
  private Double __values_score;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public Double get__values_score() {
    return __values_score;
  }

  public void set__values_score(Double __values_score) {
    this.__values_score = __values_score;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("RedisProperty{");
    sb.append("id='").append(id).append('\'');
    sb.append(", __values_score=").append(__values_score);
    sb.append('}');
    return sb.toString();
  }
}

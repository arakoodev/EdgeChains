package com.edgechain.lib.index.responses;

import java.util.ArrayList;

public class RedisDocument {

  private String id;
  private double score;
  private Object payload;
  private ArrayList<RedisProperty> properties;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public double getScore() {
    return score;
  }

  public void setScore(double score) {
    this.score = score;
  }

  public Object getPayload() {
    return payload;
  }

  public void setPayload(Object payload) {
    this.payload = payload;
  }

  public ArrayList<RedisProperty> getProperties() {
    return properties;
  }

  public void setProperties(ArrayList<RedisProperty> properties) {
    this.properties = properties;
  }
}

package com.edgechain.lib.embeddings.domain;

import java.io.Serializable;
import java.util.List;

public class WordVec implements Serializable {

  private static final long serialVersionUID = 2210956496609994219L;
  private String id;
  private List<Float> values;
  private String score;

  public WordVec() {}

  public WordVec(String id, List<Float> values) {
    this.id = id;
    this.values = values;
  }

  public WordVec(String id, List<Float> values, String score) {
    this.id = id;
    this.values = values;
    this.score = score;
  }

  public WordVec(String id, String score) {
    this.id = id;
    this.score = score;
  }

  public String getId() {
    return id;
  }

  public List<Float> getValues() {
    return values;
  }

  public void setValues(List<Float> values) {
    this.values = values;
  }

  public String getScore() {
    return score;
  }

  public void setId(String id) {
    this.id = id;
  }

  public void setScore(String score) {
    this.score = score;
  }

  @Override
  public String toString() {
    return "Vector{" + "id='" + id + '\'' + ", values=" + values + ", score='" + score + '\'' + '}';
  }
}

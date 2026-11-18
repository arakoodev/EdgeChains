package com.app.openai.embeddings;

import java.io.Serializable;
import java.util.List;

public class WordVec implements Serializable {

  private static final long serialVersionUID = 2210956496609994219L;
  private String id;
  private List<Double> values;
  private String score;

  public WordVec() {}

  public WordVec(String id, List<Double> values) {
    this.id = id;
    this.values = values;
    this.score = String.format("%.2f", 0.00);
  }

  public WordVec(String id, List<Double> values, String score) {
    this.id = id;
    this.values = values;
    this.score = score;
  }

  public String getId() {
    return id;
  }

  public List<Double> getValues() {
    return values;
  }

  public String getScore() {
    return score;
  }

  @Override
  public String toString() {
    return "Vector{" + "id='" + id + '\'' + ", values=" + values + ", score='" + score + '\'' + '}';
  }
}

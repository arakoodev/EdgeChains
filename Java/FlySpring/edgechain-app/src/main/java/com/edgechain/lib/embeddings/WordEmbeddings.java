package com.edgechain.lib.embeddings;

import com.edgechain.lib.response.ArkObject;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.Serializable;
import java.util.List;

public class WordEmbeddings implements ArkObject, Serializable {

  private static final long serialVersionUID = 2210956496609994219L;
  private String id;
  private List<Float> values;
  private Double score;

  public WordEmbeddings() {}

  // Postgres
  public WordEmbeddings(String id) {
    this.id = id;
  }

  public WordEmbeddings(String id, List<Float> values) {
    this.id = id;
    this.values = values;
  }

  public WordEmbeddings(String id, List<Float> values, Double score) {
    this.id = id;
    this.values = values;
    this.score = score;
  }

  public WordEmbeddings(String id, Double score) {
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

  public Double getScore() {
    return score;
  }

  public void setId(String id) {
    this.id = id;
  }

  public void setScore(Double score) {
    this.score = score;
  }

  @Override
  public String toString() {
    return "Vector{" + "id='" + id + '\'' + ", values=" + values + ", score='" + score + '\'' + '}';
  }

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();

    if (id != null) {
      json.put("id", id);
    }

    if (values != null) {
      json.put("values", new JSONArray(values));
    }

    if (score != null) {
      json.put("score", score);
    }

    return json;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;

    WordEmbeddings that = (WordEmbeddings) o;

    return id.equals(that.id);
  }

  @Override
  public int hashCode() {
    return id.hashCode();
  }
}

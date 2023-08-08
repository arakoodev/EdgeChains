package com.edgechain.lib.index.domain;

import java.time.LocalDateTime;
import java.util.List;

public class PostgresWordEmbeddings {

  private Long embedding_id;

  private String id;

  private String rawText;

  private String namespace;

  private String filename;

  private List<Float> values;

  private LocalDateTime timestamp;

  private Double score; // will be added

  public Long getEmbedding_id() {
    return embedding_id;
  }

  public void setEmbedding_id(Long embedding_id) {
    this.embedding_id = embedding_id;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getRawText() {
    return rawText;
  }

  public void setRawText(String rawText) {
    this.rawText = rawText;
  }

  public List<Float> getValues() {
    return values;
  }

  public void setValues(List<Float> values) {
    this.values = values;
  }

  public LocalDateTime getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(LocalDateTime timestamp) {
    this.timestamp = timestamp;
  }

  public void setScore(Double score) {
    this.score = score;
  }

  public Double getScore() {
    return score;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public String getFilename() {
    return filename;
  }

  public void setFilename(String filename) {
    this.filename = filename;
  }
}

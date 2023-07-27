package com.edgechain.lib.context.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity(name = "HistoryContext")
@Table(name = "history_context")
public class HistoryContext implements Serializable {

  private static final long serialVersionUID = 2819947915596690671L;

  @Id private String id;
  private String response;

  private LocalDateTime createdAt;

  public HistoryContext() {}

  public HistoryContext(String id, String response, LocalDateTime createdAt) {
    this.id = id;
    this.response = response;
    this.createdAt = createdAt;
  }

  public HistoryContext(String id, String response) {
    this.id = id;
    this.response = response;
  }

  public String getResponse() {
    return response;
  }

  public void setResponse(String response) {
    this.response = response;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("HistoryContext{");
    sb.append("id='").append(id).append('\'');
    sb.append(", response='").append(response).append('\'');
    sb.append(", createdAt=").append(createdAt);
    sb.append('}');
    return sb.toString();
  }
}

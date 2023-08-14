package com.edgechain.lib.context.domain;

import com.edgechain.lib.response.ArkObject;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.json.JSONObject;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity(name = "HistoryContext")
@Table(name = "history_context")
public class HistoryContext implements ArkObject, Serializable {

  @Transient private static final long serialVersionUID = 2819947915596690671L;

  @Id private String id;
  private String response;

  @JsonSerialize(using = LocalDateTimeSerializer.class)
  @JsonDeserialize(using = LocalDateTimeDeserializer.class)
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

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();
    json.put("id", id);
    json.put("response", response);
    json.put("createdAt", createdAt.toString());
    return json;
  }
}

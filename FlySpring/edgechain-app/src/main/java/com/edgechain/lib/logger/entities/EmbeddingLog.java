package com.edgechain.lib.logger.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;
import javax.validation.constraints.NotBlank;

@Table(name = "embedding_logs")
@Entity(name = "EmbeddingLog")
public class EmbeddingLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JsonIgnore
  private Long embeddingId;

  @Column(nullable = false, unique = true)
  private String id;

  @Column(nullable = false)
  @NotBlank(message = "Embedding Log: 'call_identifier' field cannot be empty or null.")
  private String callIdentifier;

  private LocalDateTime createdAt;
  private LocalDateTime completedAt;

  @Column(nullable = false)
  @NotBlank(message = "Embedding Log: 'model' field cannot be empty or null.")
  private String model;

  private Long latency;

  private Long promptTokens;
  private Long totalTokens;

  @PrePersist
  protected void onCreate() {
    setId(UUID.randomUUID().toString());
  }

  public Long getEmbeddingId() {
    return embeddingId;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getId() {
    return id;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public LocalDateTime getCompletedAt() {
    return completedAt;
  }

  public void setCompletedAt(LocalDateTime completedAt) {
    this.completedAt = completedAt;
  }

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public long getLatency() {
    return latency;
  }

  public void setLatency(Long latency) {
    this.latency = latency;
  }

  public Long getPromptTokens() {
    return promptTokens;
  }

  public void setPromptTokens(Long promptTokens) {
    this.promptTokens = promptTokens;
  }

  public Long getTotalTokens() {
    return totalTokens;
  }

  public void setTotalTokens(Long totalTokens) {
    this.totalTokens = totalTokens;
  }

  public void setEmbeddingId(Long embeddingId) {
    this.embeddingId = embeddingId;
  }

  public String getCallIdentifier() {
    return callIdentifier;
  }

  public void setCallIdentifier(String callIdentifier) {
    this.callIdentifier = callIdentifier;
  }
}

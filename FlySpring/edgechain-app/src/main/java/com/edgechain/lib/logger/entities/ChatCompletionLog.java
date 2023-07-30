package com.edgechain.lib.logger.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.UUID;

@Table(name = "chat_completion_logs")
@Entity(name = "ChatCompletionLog")
public class ChatCompletionLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JsonIgnore
  private Long chatCompletionId;

  @Column(nullable = false, unique = true)
  private String id;

  @Column(nullable = false)
  @NotBlank(message = "Chat Completion Log: 'name' field cannot be empty or null.")
  private String name;

  @Column(nullable = false)
  @NotBlank(message = "Chat Completion Log: 'call_identifier' field cannot be empty or null.")
  private String callIdentifier;

  @Column(nullable = false)
  @NotBlank
  private String type;

  private LocalDateTime createdAt;
  private LocalDateTime completedAt;

  @Column(nullable = false)
  @NotBlank(message = "Chat Completion Log: 'model' field cannot be empty or null.")
  private String model;

  @Column(columnDefinition = "TEXT")
  @NotBlank
  private String input;

  @Column(columnDefinition = "TEXT")
  private String content;

  private Long latency;

  private Long promptTokens;
  private Long totalTokens;

  @PrePersist
  protected void onCreate() {
    setId(UUID.randomUUID().toString());
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getId() {
    return id;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
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

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public long getLatency() {
    return latency;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
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

  public Long getChatCompletionId() {
    return chatCompletionId;
  }

  public void setChatCompletionId(Long chatCompletionId) {
    this.chatCompletionId = chatCompletionId;
  }

  public String getCallIdentifier() {
    return callIdentifier;
  }

  public void setCallIdentifier(String callIdentifier) {
    this.callIdentifier = callIdentifier;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("ChatCompletionLog{");
    sb.append("chatCompletionId=").append(chatCompletionId);
    sb.append(", id='").append(id).append('\'');
    sb.append(", name='").append(name).append('\'');
    sb.append(", callIdentifier='").append(callIdentifier).append('\'');
    sb.append(", type='").append(type).append('\'');
    sb.append(", createdAt=").append(createdAt);
    sb.append(", completedAt=").append(completedAt);
    sb.append(", model='").append(model).append('\'');
    sb.append(", input='").append(input).append('\'');
    sb.append(", content='").append(content).append('\'');
    sb.append(", latency=").append(latency);
    sb.append(", promptTokens=").append(promptTokens);
    sb.append(", totalTokens=").append(totalTokens);
    sb.append('}');
    return sb.toString();
  }
}

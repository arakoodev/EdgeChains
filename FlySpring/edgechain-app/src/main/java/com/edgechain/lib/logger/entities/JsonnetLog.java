package com.edgechain.lib.logger.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.StringJoiner;
import java.util.UUID;

@Table(name = "jsonnet_logs")
@Entity(name = "JsonnetLog")
public class JsonnetLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JsonIgnore
  private Long jsonnetLogId;

  @Column(nullable = false, unique = true)
  private String id;

  @Column(nullable = false)
  private String splitSize;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String metadata;

  @Column(columnDefinition = "TEXT")
  private String content;

  private String selectedFile;

  @Column(nullable = false)
  private String f1;

  @Column(nullable = false)
  private String f2;

  private LocalDateTime createdAt;

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

  public String getSplitSize() {
    return splitSize;
  }

  public void setSplitSize(String splitSize) {
    this.splitSize = splitSize;
  }

  public String getMetadata() {
    return metadata;
  }

  public void setMetadata(String jsonString) {
    this.metadata = jsonString;
  }

  public String getF1() {
    return f1;
  }

  public void setF1(String f1) {
    this.f1 = f1;
  }

  public String getF2() {
    return f2;
  }

  public void setF2(String f2) {
    this.f2 = f2;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public String getSelectedFile() {
    return selectedFile;
  }

  public void setSelectedFile(String selectedFile) {
    this.selectedFile = selectedFile;
  }

  @Override
  public String toString() {
    return new StringJoiner(", ", JsonnetLog.class.getSimpleName() + "[", "]")
        .add("id='" + id + "'")
        .add("splitSize=" + splitSize)
        .add("metadata='" + metadata + "'")
        .add("content='" + content + "'")
        .add("f1='" + f1 + "'")
        .add("f2='" + f2 + "'")
        .add("createdAt=" + createdAt)
        .toString();
  }
}

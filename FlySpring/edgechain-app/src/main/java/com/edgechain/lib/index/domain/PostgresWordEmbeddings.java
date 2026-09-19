package com.edgechain.lib.index.domain;

import com.edgechain.lib.response.ArkObject;
import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDateTime;
import java.util.List;

public class PostgresWordEmbeddings implements ArkObject {

  //  private Long embedding_id;
  //
  //  private Integer embedding_id;
  private String id;

  private String rawText;

  private String namespace;

  private String filename;

  private List<Float> values;

  private LocalDateTime timestamp;

  private Double score;

  private String metadata;
  private String metadataId;
  private String titleMetadata;
  private String documentDate;

  //  public Integer getEmbedding_id() {
  //    return embedding_id;
  //  }
  //
  //  public void setEmbedding_id(Integer embedding_id) {
  //    this.embedding_id = embedding_id;
  //  }

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

  public String getMetadata() {
    return metadata;
  }

  public void setMetadata(String metadata) {
    this.metadata = metadata;
  }

  public String getMetadataId() {
    return metadataId;
  }

  public void setMetadataId(String metadataId) {
    this.metadataId = metadataId;
  }

  public String getTitleMetadata() {
    return titleMetadata;
  }

  public void setTitleMetadata(String titleMetadata) {
    this.titleMetadata = titleMetadata;
  }

  public String getDocumentDate() {
    return documentDate;
  }

  public void setDocumentDate(String documentDate) {
    this.documentDate = documentDate;
  }

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();

    //    if (embedding_id != null) {
    //      json.put("embedding_id", embedding_id);
    //    }

    if (id != null) {
      json.put("id", id);
    }

    if (rawText != null) {
      json.put("rawText", rawText);
    }

    if (namespace != null) {
      json.put("namespace", namespace);
    }

    if (filename != null) {
      json.put("filename", filename);
    }

    if (values != null) {
      json.put("values", new JSONArray(values));
    }

    if (timestamp != null) {
      json.put("timestamp", timestamp.toString());
    }

    if (score != null && !Double.isNaN(score)) {
      json.put("score", score);
    }

    if (titleMetadata != null) {
      json.put("titleMetadata", titleMetadata);
    }

    if (documentDate != null) {
      json.put("documentDate", documentDate);
    }

    if (metadata != null) {
      json.put("metadata", metadata);
    }
    if (metadataId != null) {
      json.put("metadataId", metadataId);
    }

    return json;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;

    PostgresWordEmbeddings that = (PostgresWordEmbeddings) o;

    return id.equals(that.id);
  }

  @Override
  public int hashCode() {
    return id.hashCode();
  }
}

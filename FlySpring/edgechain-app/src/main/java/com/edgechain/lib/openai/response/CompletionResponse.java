package com.edgechain.lib.openai.response;

import com.edgechain.lib.embeddings.response.Usage;

import java.util.List;

public class CompletionResponse {

  private String id;

  private String object;

  private long created;

  private String model;

  private List<CompletionChoice> choices;

  private Usage usage;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getObject() {
    return object;
  }

  public void setObject(String object) {
    this.object = object;
  }

  public long getCreated() {
    return created;
  }

  public void setCreated(long created) {
    this.created = created;
  }

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public List<CompletionChoice> getChoices() {
    return choices;
  }

  public void setChoices(List<CompletionChoice> choices) {
    this.choices = choices;
  }

  public Usage getUsage() {
    return usage;
  }

  public void setUsage(Usage usage) {
    this.usage = usage;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("CompletionResponse{");
    sb.append("id='").append(id).append('\'');
    sb.append(", object='").append(object).append('\'');
    sb.append(", created=").append(created);
    sb.append(", model='").append(model).append('\'');
    sb.append(", choices=").append(choices);
    sb.append(", usage=").append(usage);
    sb.append('}');
    return sb.toString();
  }
}

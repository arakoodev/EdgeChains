package com.example.htmxuidemo;

import java.io.Serializable;
import java.util.List;

public class ChatCompletionResponse implements Serializable {

  private static final long serialVersionUID = 463938151412139368L;
  private String id;

  private String object;
  private long created;

  private String model;

  private List<ChatCompletionChoice> choices;

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

  public List<ChatCompletionChoice> getChoices() {
    return choices;
  }

  public void setChoices(List<ChatCompletionChoice> choices) {
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
    final StringBuilder sb = new StringBuilder("ChatCompletionResponse{");
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

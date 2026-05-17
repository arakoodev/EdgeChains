package com.edgechain.lib.openai.response;

import com.edgechain.lib.embeddings.response.Usage;
import com.edgechain.lib.response.ArkObject;
import org.json.JSONObject;

import java.io.Serializable;
import java.util.List;
import java.util.stream.Collectors;

public class ChatCompletionResponse implements ArkObject, Serializable {

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

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();

    if (id != null) {
      json.put("id", id);
    }

    if (object != null) {
      json.put("object", object);
    }

    json.put("created", created);

    if (model != null) {
      json.put("model", model);
    }

    if (choices != null) {
      json.put(
          "choices",
          choices.stream().map(ChatCompletionChoice::toJson).collect(Collectors.toList()));
    }

    if (usage != null) {
      json.put("usage", usage.toJson());
    }

    return json;
  }
}

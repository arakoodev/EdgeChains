package com.edgechain.lib.embeddings.response;

import com.edgechain.lib.response.ArkObject;
import org.json.JSONObject;

import java.util.List;
import java.util.stream.Collectors;

public class OpenAiEmbeddingResponse implements ArkObject {

  private String model;
  private String object;
  private List<OpenAiEmbedding> data;
  private Usage usage;

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public String getObject() {
    return object;
  }

  public void setObject(String object) {
    this.object = object;
  }

  public List<OpenAiEmbedding> getData() {
    return data;
  }

  public void setData(List<OpenAiEmbedding> data) {
    this.data = data;
  }

  public Usage getUsage() {
    return usage;
  }

  public void setUsage(Usage usage) {
    this.usage = usage;
  }

  @Override
  public String toString() {
    return "OpenAiEmbeddingResponse{"
        + "model='"
        + model
        + '\''
        + ", object='"
        + object
        + '\''
        + ", data="
        + data
        + ", usage="
        + usage
        + '}';
  }

  @Override
  public JSONObject toJson() {
    JSONObject jsonObject = new JSONObject();
    jsonObject.put("model", model);
    jsonObject.put("object", object);
    jsonObject.put("data", data.stream().map(OpenAiEmbedding::toJson).collect(Collectors.toList()));
    jsonObject.put("usage", usage.toJson());
    return jsonObject;
  }
}

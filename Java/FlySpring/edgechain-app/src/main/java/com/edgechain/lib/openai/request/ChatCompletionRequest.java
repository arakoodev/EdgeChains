package com.edgechain.lib.openai.request;

import java.util.List;

public class ChatCompletionRequest {

  private String model;
  private Double temperature;
  private List<ChatMessage> messages;
  private Boolean stream;

  public ChatCompletionRequest() {}

  public ChatCompletionRequest(
      String model, List<ChatMessage> messages, Double temperature, Boolean stream) {
    this.model = model;
    this.temperature = temperature;
    this.messages = messages;
    this.stream = stream;
  }

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public List<ChatMessage> getMessages() {
    return messages;
  }

  public void setMessages(List<ChatMessage> messages) {
    this.messages = messages;
  }

  public Double getTemperature() {
    return temperature;
  }

  public void setTemperature(Double temperature) {
    this.temperature = temperature;
  }

  public Boolean getStream() {
    return stream;
  }

  public void setStream(Boolean stream) {
    this.stream = stream;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("ChatCompletionRequest{");
    sb.append("model='").append(model).append('\'');
    sb.append(", temperature=").append(temperature);
    sb.append(", messages=").append(messages);
    sb.append(", stream=").append(stream);
    sb.append('}');
    return sb.toString();
  }

  public static ChatCompletionRequestBuilder builder() {
    return new ChatCompletionRequestBuilder();
  }

  public static class ChatCompletionRequestBuilder {
    private String model;
    private Double temperature;
    private List<ChatMessage> messages;

    private Boolean stream = Boolean.FALSE;

    public ChatCompletionRequestBuilder model(String model) {
      this.model = model;
      return this;
    }

    public ChatCompletionRequestBuilder temperature(Double temperature) {
      this.temperature = temperature;
      return this;
    }

    public ChatCompletionRequestBuilder messages(List<ChatMessage> messages) {
      this.messages = messages;
      return this;
    }

    public ChatCompletionRequestBuilder stream(Boolean value) {
      this.stream = value;
      return this;
    }

    public ChatCompletionRequest build() {
      return new ChatCompletionRequest(model, messages, temperature, stream);
    }
  }
}

package com.edgechain.lib.openai.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.*;

public class ChatCompletionRequest {

  private static final Double DEFAULT_TEMPERATURE = 0.7;
  private static final Boolean DEFAULT_STREAM = false;
  private static final Double DEFAULT_TOP_P = 1.0;
  private static final Integer DEFAULT_N = 1;
  private static final List<String> DEFAULT_STOP = Collections.emptyList();
  private static final Double DEFAULT_PRESENCE_PENALTY = 0.0;
  private static final Double DEFAULT_FREQUENCY_PENALTY = 0.0;
  private static final Map<String, Integer> DEFAULT_LOGIT_BIAS = Collections.emptyMap();
  private static final String DEFAULT_USER = "";

  private String model;
  private Double temperature;
  private List<ChatMessage> messages;
  private Boolean stream;

  @JsonProperty("top_p")
  private Double topP;

  private Integer n;

  private List<String> stop;

  @JsonProperty("presence_penalty")
  private Double presencePenalty;

  @JsonProperty("frequency_penalty")
  private Double frequencyPenalty;

  @JsonProperty("logit_bias")
  private Map<String, Integer> logitBias;

  private String user;

  public ChatCompletionRequest() {}

  public ChatCompletionRequest(
      String model,
      Double temperature,
      List<ChatMessage> messages,
      Boolean stream,
      Double topP,
      Integer n,
      List<String> stop,
      Double presencePenalty,
      Double frequencyPenalty,
      Map<String, Integer> logitBias,
      String user) {
    this.model = model;
    this.temperature = (temperature != null) ? temperature : DEFAULT_TEMPERATURE;
    this.messages = messages;
    this.stream = (stream != null) ? stream : DEFAULT_STREAM;
    this.topP = (topP != null) ? topP : DEFAULT_TOP_P;
    this.n = (n != null) ? n : DEFAULT_N;
    this.stop = (stop != null) ? stop : DEFAULT_STOP;
    this.presencePenalty = (presencePenalty != null) ? presencePenalty : DEFAULT_PRESENCE_PENALTY;
    this.frequencyPenalty =
        (frequencyPenalty != null) ? frequencyPenalty : DEFAULT_FREQUENCY_PENALTY;
    this.logitBias = (logitBias != null) ? logitBias : DEFAULT_LOGIT_BIAS;
    this.user = (user != null) ? user : DEFAULT_USER;
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

  public Double getTopP() {
    return topP;
  }

  public Integer getN() {
    return n;
  }

  public List<String> getStop() {
    return stop;
  }

  public Double getPresencePenalty() {
    return presencePenalty;
  }

  public Double getFrequencyPenalty() {
    return frequencyPenalty;
  }

  public Map<String, Integer> getLogitBias() {
    return logitBias;
  }

  public String getUser() {
    return user;
  }

  @Override
  public String toString() {
    return new StringJoiner(", ", ChatCompletionRequest.class.getSimpleName() + "[", "]")
        .add("model='" + model + "'")
        .add("temperature=" + temperature)
        .add("messages=" + messages)
        .add("stream=" + stream)
        .add("topP=" + topP)
        .add("n=" + n)
        .add("stop=" + stop)
        .add("presencePenalty=" + presencePenalty)
        .add("frequencyPenalty=" + frequencyPenalty)
        .add("logitBias=" + logitBias)
        .add("user='" + user + "'")
        .toString();
  }

  public static ChatCompletionRequestBuilder builder() {
    return new ChatCompletionRequestBuilder();
  }

  public static class ChatCompletionRequestBuilder {
    private String model;
    private Double temperature;
    private List<ChatMessage> messages;
    private Boolean stream;

    @JsonProperty("top_p")
    private Double topP;

    private Integer n;
    private List<String> stop;

    @JsonProperty("presence_penalty")
    private Double presencePenalty;

    @JsonProperty("frequency_penalty")
    private Double frequencyPenalty;

    @JsonProperty("logit_bias")
    private Map<String, Integer> logitBias;

    private String user;

    private ChatCompletionRequestBuilder() {}

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

    public ChatCompletionRequestBuilder stream(Boolean stream) {
      this.stream = stream;
      return this;
    }

    public ChatCompletionRequestBuilder topP(Double topP) {
      this.topP = topP;
      return this;
    }

    public ChatCompletionRequestBuilder n(Integer n) {
      this.n = n;
      return this;
    }

    public ChatCompletionRequestBuilder stop(List<String> stop) {
      this.stop = stop;
      return this;
    }

    public ChatCompletionRequestBuilder presencePenalty(Double presencePenalty) {
      this.presencePenalty = presencePenalty;
      return this;
    }

    public ChatCompletionRequestBuilder frequencyPenalty(Double frequencyPenalty) {
      this.frequencyPenalty = frequencyPenalty;
      return this;
    }

    public ChatCompletionRequestBuilder logitBias(Map<String, Integer> logitBias) {
      this.logitBias = logitBias;
      return this;
    }

    public ChatCompletionRequestBuilder user(String user) {
      this.user = user;
      return this;
    }

    public ChatCompletionRequest build() {
      return new ChatCompletionRequest(
          model,
          temperature,
          messages,
          stream,
          topP,
          n,
          stop,
          presencePenalty,
          frequencyPenalty,
          logitBias,
          user);
    }
  }
}

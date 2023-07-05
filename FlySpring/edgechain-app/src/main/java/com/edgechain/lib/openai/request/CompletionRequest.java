package com.edgechain.lib.openai.request;

public class CompletionRequest {

  private String prompt;
  private String model;
  private Double temperature;
  private Double top_p;
  private Double frequency_penalty;
  private Double presence_penalty;

  public CompletionRequest() {}

  public CompletionRequest(
      String prompt,
      String model,
      Double temperature,
      Integer max_tokens,
      Double top_p,
      Double frequency_penalty,
      Double presence_penalty) {
    this.prompt = prompt;
    this.model = model;
    this.temperature = temperature;
    this.top_p = top_p == null ? 1.0 : top_p;
    this.frequency_penalty = frequency_penalty == null ? 0.0 : frequency_penalty;
    this.presence_penalty = presence_penalty == null ? 0.0 : presence_penalty;
  }

  public String getPrompt() {
    return prompt;
  }

  public void setPrompt(String prompt) {
    this.prompt = prompt;
  }

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public Double getTemperature() {
    return temperature;
  }

  public void setTemperature(Double temperature) {
    this.temperature = temperature;
  }

  public Double getTop_p() {
    return top_p;
  }

  public void setTop_p(Double top_p) {
    this.top_p = top_p;
  }

  public Double getFrequency_penalty() {
    return frequency_penalty;
  }

  public void setFrequency_penalty(Double frequency_penalty) {
    this.frequency_penalty = frequency_penalty;
  }

  public Double getPresence_penalty() {
    return presence_penalty;
  }

  public void setPresence_penalty(Double presence_penalty) {
    this.presence_penalty = presence_penalty;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("CompletionRequest{");
    sb.append("prompt='").append(prompt).append('\'');
    sb.append(", model='").append(model).append('\'');
    sb.append(", temperature=").append(temperature);
    sb.append(", top_p=").append(top_p);
    sb.append(", frequency_penalty=").append(frequency_penalty);
    sb.append(", presence_penalty=").append(presence_penalty);
    sb.append('}');
    return sb.toString();
  }

  public static CompletionRequestBuilder builder() {
    return new CompletionRequestBuilder();
  }

  public static class CompletionRequestBuilder {
    private String prompt;
    private String model;
    private Double temperature;
    private Integer max_tokens;
    private Double top_p;
    private Double frequency_penalty;
    private Double presence_penalty;

    public CompletionRequestBuilder prompt(String prompt) {
      this.prompt = prompt;
      return this;
    }

    public CompletionRequestBuilder model(String model) {
      this.model = model;
      return this;
    }

    public CompletionRequestBuilder temperature(Double temperature) {
      this.temperature = temperature;
      return this;
    }

    public CompletionRequestBuilder maxTokens(Integer max_tokens) {
      this.max_tokens = max_tokens;
      return this;
    }

    public CompletionRequestBuilder topP(Double top_p) {
      this.top_p = top_p;
      return this;
    }

    public CompletionRequestBuilder frequencyPenalty(Double frequency_penalty) {
      this.frequency_penalty = frequency_penalty;
      return this;
    }

    public CompletionRequestBuilder presencePenalty(Double presence_penalty) {
      this.presence_penalty = presence_penalty;
      return this;
    }

    public CompletionRequest build() {
      return new CompletionRequest(
          this.prompt,
          this.model,
          this.temperature,
          this.max_tokens,
          this.top_p,
          this.frequency_penalty,
          this.presence_penalty);
    }
  }
}

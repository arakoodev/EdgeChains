package com.edgechain.lib.llama2.request;

import org.json.JSONObject;

import java.util.StringJoiner;

public class Llama2ChatCompletionRequest {

  private String inputs;
  private JSONObject parameters;

  public Llama2ChatCompletionRequest() {}

  public Llama2ChatCompletionRequest(String inputs, JSONObject parameters) {
    this.inputs = inputs;
    this.parameters = parameters;
  }

  @Override
  public String toString() {
    return new StringJoiner(", ", Llama2ChatCompletionRequest.class.getSimpleName() + "[{", "}]")
        .add("\"inputs:\"" + inputs)
        .add("\"parameters:\"" + parameters)
        .toString();
  }

  public static Llama2ChatCompletionRequestBuilder builder() {
    return new Llama2ChatCompletionRequestBuilder();
  }

  public String getInputs() {
    return inputs;
  }

  public void setInputs(String inputs) {
    this.inputs = inputs;
  }

  public JSONObject getParameters() {
    return parameters;
  }

  public void setParameters(JSONObject parameters) {
    this.parameters = parameters;
  }

  public static class Llama2ChatCompletionRequestBuilder {
    private String inputs;
    private JSONObject parameters;

    private Llama2ChatCompletionRequestBuilder() {}

    public Llama2ChatCompletionRequestBuilder inputs(String inputs) {
      this.inputs = inputs;
      return this;
    }

    public Llama2ChatCompletionRequestBuilder parameters(JSONObject parameters) {
      this.parameters = parameters;
      return this;
    }

    public Llama2ChatCompletionRequest build() {
      return new Llama2ChatCompletionRequest(inputs, parameters);
    }
  }
}

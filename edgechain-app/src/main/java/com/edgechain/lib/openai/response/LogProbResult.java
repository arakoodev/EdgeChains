package com.edgechain.lib.openai.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class LogProbResult {

  List<String> tokens;

  @JsonProperty("token_logprobs")
  List<Double> tokenLogprobs;

  @JsonProperty("top_logprobs")
  List<Map<String, Double>> topLogprobs;

  List<Integer> textOffset;

  public List<String> getTokens() {
    return tokens;
  }

  public void setTokens(List<String> tokens) {
    this.tokens = tokens;
  }

  public List<Double> getTokenLogprobs() {
    return tokenLogprobs;
  }

  public void setTokenLogprobs(List<Double> tokenLogprobs) {
    this.tokenLogprobs = tokenLogprobs;
  }

  public List<Map<String, Double>> getTopLogprobs() {
    return topLogprobs;
  }

  public void setTopLogprobs(List<Map<String, Double>> topLogprobs) {
    this.topLogprobs = topLogprobs;
  }

  public List<Integer> getTextOffset() {
    return textOffset;
  }

  public void setTextOffset(List<Integer> textOffset) {
    this.textOffset = textOffset;
  }
}

package com.edgechain.lib.endpoint.impl.llm;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.Llama2Service;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.reactivex.rxjava3.core.Observable;
import org.json.JSONObject;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.List;
import java.util.Objects;

public class Llama2Endpoint extends Endpoint {
  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final Llama2Service llama2Service = retrofit.create(Llama2Service.class);

  private final ModelMapper modelMapper = new ModelMapper();

  private String inputs;
  private JSONObject parameters;
  private Double temperature;

  @JsonProperty("top_k")
  private Integer topK;

  @JsonProperty("top_p")
  private Double topP;

  @JsonProperty("do_sample")
  private Boolean doSample;

  @JsonProperty("max_new_tokens")
  private Integer maxNewTokens;

  @JsonProperty("repetition_penalty")
  private Double repetitionPenalty;

  private List<String> stop;
  private String chainName;
  private String callIdentifier;

  public Llama2Endpoint() {}

  public Llama2Endpoint(
      String url,
      RetryPolicy retryPolicy,
      Double temperature,
      Integer topK,
      Double topP,
      Boolean doSample,
      Integer maxNewTokens,
      Double repetitionPenalty,
      List<String> stop) {
    super(url, retryPolicy);
    this.temperature = temperature;
    this.topK = topK;
    this.topP = topP;
    this.doSample = doSample;
    this.maxNewTokens = maxNewTokens;
    this.repetitionPenalty = repetitionPenalty;
    this.stop = stop;
  }

  public Llama2Endpoint(String url, RetryPolicy retryPolicy) {
    super(url, retryPolicy);
    this.temperature = 0.7;
    this.maxNewTokens = 512;
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

  public Double getTemperature() {
    return temperature;
  }

  public void setTemperature(Double temperature) {
    this.temperature = temperature;
  }

  public Integer getTopK() {
    return topK;
  }

  public void setTopK(Integer topK) {
    this.topK = topK;
  }

  public Double getTopP() {
    return topP;
  }

  public void setTopP(Double topP) {
    this.topP = topP;
  }

  public Boolean getDoSample() {
    return doSample;
  }

  public void setDoSample(Boolean doSample) {
    this.doSample = doSample;
  }

  public Integer getMaxNewTokens() {
    return maxNewTokens;
  }

  public void setMaxNewTokens(Integer maxNewTokens) {
    this.maxNewTokens = maxNewTokens;
  }

  public Double getRepetitionPenalty() {
    return repetitionPenalty;
  }

  public void setRepetitionPenalty(Double repetitionPenalty) {
    this.repetitionPenalty = repetitionPenalty;
  }

  public List<String> getStop() {
    return stop;
  }

  public void setStop(List<String> stop) {
    this.stop = stop;
  }

  public String getChainName() {
    return chainName;
  }

  public void setChainName(String chainName) {
    this.chainName = chainName;
  }

  public String getCallIdentifier() {
    return callIdentifier;
  }

  public void setCallIdentifier(String callIdentifier) {
    this.callIdentifier = callIdentifier;
  }

  public Observable<List<Llama2ChatCompletionResponse>> chatCompletion(
      String inputs, String chainName, ArkRequest arkRequest) {

    Llama2Endpoint mapper = modelMapper.map(this, Llama2Endpoint.class);
    mapper.setInputs(inputs);
    mapper.setChainName(chainName);
    return chatCompletion(mapper, arkRequest);
  }

  private Observable<List<Llama2ChatCompletionResponse>> chatCompletion(
      Llama2Endpoint mapper, ArkRequest arkRequest) {

    if (Objects.nonNull(arkRequest)) mapper.setCallIdentifier(arkRequest.getRequestURI());
    else mapper.setCallIdentifier("URI wasn't provided");

    return Observable.fromSingle(this.llama2Service.chatCompletion(mapper));
  }
}

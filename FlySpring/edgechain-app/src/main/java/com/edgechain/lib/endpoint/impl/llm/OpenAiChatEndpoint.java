package com.edgechain.lib.endpoint.impl.llm;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.CompletionResponse;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.client.OpenAiStreamService;
import com.edgechain.lib.retrofit.OpenAiService;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.List;
import java.util.Map;
import java.util.Objects;

public class OpenAiChatEndpoint extends Endpoint {

  private final OpenAiStreamService openAiStreamService =
      ApplicationContextHolder.getContext().getBean(OpenAiStreamService.class);

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final OpenAiService openAiService = retrofit.create(OpenAiService.class);

  private ModelMapper modelMapper = new ModelMapper();

  private String orgId;
  private String model;

  private Double temperature;
  private List<ChatMessage> chatMessages;
  private Boolean stream;
  private Double topP;
  private Integer n;
  private List<String> stop;
  private Double presencePenalty;
  private Double frequencyPenalty;
  private Map<String, Integer> logitBias;
  private String user;

  private String role;

  private String input;

  /** Log fields * */
  private String chainName;

  private String callIdentifier;

  private JsonnetLoader jsonnetLoader;

  public OpenAiChatEndpoint() {}

  public OpenAiChatEndpoint(String url, String apiKey, String model) {
    super(url, apiKey, null);
    this.model = model;
  }

  // For Embeddings....
  public OpenAiChatEndpoint(
      String url, String apiKey, String orgId, String model, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.orgId = orgId;
    this.model = model;
  }

  public OpenAiChatEndpoint(
      String url,
      String apiKey,
      String model,
      String role,
      Double temperature,
      RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.model = model;
    this.role = role;
    this.temperature = temperature;
  }

  public OpenAiChatEndpoint(
      String url, String apiKey, String model, String role, Double temperature, Boolean stream) {
    super(url, apiKey, null);
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.stream = stream;
  }

  public OpenAiChatEndpoint(
      String url,
      String apiKey,
      String orgId,
      String model,
      String role,
      Double temperature,
      RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.orgId = orgId;
  }

  public OpenAiChatEndpoint(
      String url,
      String apiKey,
      String orgId,
      String model,
      String role,
      Double temperature,
      Boolean stream) {
    super(url, apiKey, null);
    this.orgId = orgId;
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.stream = stream;
  }

  public OpenAiChatEndpoint(
      String url,
      String apiKey,
      String orgId,
      String model,
      String role,
      Double temperature,
      Boolean stream,
      RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.orgId = orgId;
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.stream = stream;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public String getModel() {
    return model;
  }

  public Double getTemperature() {
    return temperature;
  }

  public Boolean getStream() {
    return stream;
  }

  public void setOrgId(String orgId) {
    this.orgId = orgId;
  }

  public String getOrgId() {
    return orgId;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public void setTemperature(Double temperature) {
    this.temperature = temperature;
  }

  public void setStream(Boolean stream) {
    this.stream = stream;
  }

  public Double getTopP() {
    return topP;
  }

  public void setTopP(Double topP) {
    this.topP = topP;
  }

  public Integer getN() {
    return n;
  }

  public void setN(Integer n) {
    this.n = n;
  }

  public List<String> getStop() {
    return stop;
  }

  public String getInput() {
    return input;
  }

  public void setStop(List<String> stop) {
    this.stop = stop;
  }

  public Double getPresencePenalty() {
    return presencePenalty;
  }

  public void setPresencePenalty(Double presencePenalty) {
    this.presencePenalty = presencePenalty;
  }

  public Double getFrequencyPenalty() {
    return frequencyPenalty;
  }

  public void setFrequencyPenalty(Double frequencyPenalty) {
    this.frequencyPenalty = frequencyPenalty;
  }

  public Map<String, Integer> getLogitBias() {
    return logitBias;
  }

  public void setLogitBias(Map<String, Integer> logitBias) {
    this.logitBias = logitBias;
  }

  public String getUser() {
    return user;
  }

  public void setUser(String user) {
    this.user = user;
  }

  public void setCallIdentifier(String callIdentifier) {
    this.callIdentifier = callIdentifier;
  }

  public List<ChatMessage> getChatMessages() {
    return chatMessages;
  }

  public void setChatMessages(List<ChatMessage> chatMessages) {
    this.chatMessages = chatMessages;
  }

  public void setJsonnetLoader(JsonnetLoader jsonnetLoader) {
    this.jsonnetLoader = jsonnetLoader;
  }

  public JsonnetLoader getJsonnetLoader() {
    return jsonnetLoader;
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

  public Observable<ChatCompletionResponse> chatCompletion(
      String input, String chainName, ArkRequest arkRequest) {

    OpenAiChatEndpoint mapper = modelMapper.map(this, OpenAiChatEndpoint.class);
    mapper.setChatMessages(List.of(new ChatMessage(this.role, input)));
    mapper.setChainName(chainName);

    return chatCompletion(mapper, arkRequest);
  }

  public Observable<ChatCompletionResponse> chatCompletion(
      String input, String chainName, JsonnetLoader loader, ArkRequest arkRequest) {

    OpenAiChatEndpoint mapper = modelMapper.map(this, OpenAiChatEndpoint.class);
    mapper.setChatMessages(List.of(new ChatMessage(this.role, input)));
    mapper.setChainName(chainName);
    mapper.setJsonnetLoader(loader);

    return chatCompletion(mapper, arkRequest);
  }

  public Observable<ChatCompletionResponse> chatCompletion(
      List<ChatMessage> chatMessages, String chainName, ArkRequest arkRequest) {
    OpenAiChatEndpoint mapper = modelMapper.map(this, OpenAiChatEndpoint.class);
    mapper.setChatMessages(chatMessages);
    mapper.setChainName(chainName);
    return chatCompletion(mapper, arkRequest);
  }

  public Observable<ChatCompletionResponse> chatCompletion(
      List<ChatMessage> chatMessages,
      String chainName,
      JsonnetLoader loader,
      ArkRequest arkRequest) {

    OpenAiChatEndpoint mapper = modelMapper.map(this, OpenAiChatEndpoint.class);
    mapper.setChatMessages(chatMessages);
    mapper.setChainName(chainName);
    mapper.setJsonnetLoader(loader);

    return chatCompletion(mapper, arkRequest);
  }

  private Observable<ChatCompletionResponse> chatCompletion(
      OpenAiChatEndpoint mapper, ArkRequest arkRequest) {

    if (Objects.nonNull(arkRequest)) mapper.setCallIdentifier(arkRequest.getRequestURI());
    else mapper.setCallIdentifier("URI wasn't provided");

    if (Objects.nonNull(getStream()) && getStream())
      return this.openAiStreamService
          .chatCompletion(mapper)
          .map(
              chatResponse -> {
                if (!Objects.isNull(chatResponse.getChoices().get(0).getFinishReason())) {
                  chatResponse.getChoices().get(0).getMessage().setContent("");
                  return chatResponse;
                } else return chatResponse;
              });
    else return Observable.fromSingle(this.openAiService.chatCompletion(mapper));
  }

  public Observable<CompletionResponse> completion(String input, ArkRequest arkRequest) {
    if (Objects.nonNull(arkRequest)) this.callIdentifier = arkRequest.getRequestURI();
    else this.callIdentifier = "URI wasn't provided";

    this.input = input;
    return Observable.fromSingle(this.openAiService.completion(this));
  }
}

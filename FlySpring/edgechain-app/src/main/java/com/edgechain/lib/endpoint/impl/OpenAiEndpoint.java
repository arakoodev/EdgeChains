package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.retrofit.client.OpenAiStreamService;
import com.edgechain.lib.retrofit.OpenAiService;
import com.edgechain.lib.openai.request.feign.OpenAiChatRequest;
import com.edgechain.lib.openai.request.feign.OpenAiEmbeddingsRequest;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.util.Objects;

public class OpenAiEndpoint extends Endpoint {

  private final OpenAiStreamService openAiStreamService =
      ApplicationContextHolder.getContext().getBean(OpenAiStreamService.class);

  private String model;
  private String role;
  private Double temperature;

  private Boolean stream;

  public OpenAiEndpoint() {}

  public OpenAiEndpoint(String url, String apiKey, String model) {
    super(url, apiKey, null);
    this.model = model;
  }

  public OpenAiEndpoint(String url, String apiKey, String model, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.model = model;
  }

  public OpenAiEndpoint(
      String url, String apiKey, String model, String role, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.model = model;
    this.role = role;
  }

  public OpenAiEndpoint(
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

  public OpenAiEndpoint(
      String url, String apiKey, String model, String role, Double temperature, Boolean stream) {
    super(url, apiKey, null);
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.stream = stream;
  }

  public OpenAiEndpoint(
      String url,
      String apiKey,
      String model,
      String role,
      Double temperature,
      Boolean stream,
      RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.stream = stream;
  }

  public String getModel() {
    return model;
  }

  public String getRole() {
    return role;
  }

  public Double getTemperature() {
    return temperature;
  }

  public Boolean getStream() {
    return stream;
  }

  public Observable<ChatCompletionResponse> getChatCompletion(String input) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    OpenAiService openAiService = retrofit.create(OpenAiService.class);

    if (Objects.nonNull(this.getStream()) && this.getStream())
      return this.openAiStreamService
          .chatCompletion(new OpenAiChatRequest(this, input))
          .map(
              chatResponse -> {
                if (!Objects.isNull(chatResponse.getChoices().get(0).getFinishReason())) {
                  chatResponse.getChoices().get(0).getMessage().setContent("");
                  return chatResponse;
                } else return chatResponse;
              });
    else
      return Observable.fromSingle(
          openAiService.chatCompletion(new OpenAiChatRequest(this, input)));
  }

  public Observable<WordEmbeddings> getEmbeddings(String input) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    OpenAiService openAiService = retrofit.create(OpenAiService.class);

    return Observable.fromSingle(
        openAiService
            .embeddings(new OpenAiEmbeddingsRequest(this, input))
            .map(
                embeddingResponse ->
                    new WordEmbeddings(input, embeddingResponse.getData().get(0).getEmbedding())));
  }
}

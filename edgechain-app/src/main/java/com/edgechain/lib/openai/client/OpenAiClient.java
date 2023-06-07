package com.edgechain.lib.openai.client;

import com.edgechain.lib.embeddings.domain.openai.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.domain.openai.OpenAiEmbeddingResponse;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Objects;

@Service
public class OpenAiClient {

  private final RestTemplate restTemplate = new RestTemplate();

  public EdgeChain<ChatCompletionResponse> createChatCompletion(Endpoint endpoint, ChatCompletionRequest request) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                System.out.println("Logging....");

                // Create headers
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(endpoint.getApiKey());

                HttpEntity<ChatCompletionRequest> entity = new HttpEntity<>(request, headers);

                System.out.println(entity.getBody());

                // Send the POST request
                ResponseEntity<ChatCompletionResponse> response =
                    restTemplate.exchange(endpoint.getUrl(), HttpMethod.POST, entity, ChatCompletionResponse.class);

                emitter.onNext(Objects.requireNonNull(response.getBody()));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  public EdgeChain<CompletionResponse> createCompletion(Endpoint endpoint, CompletionRequest request) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(endpoint.getApiKey());

                HttpEntity<CompletionRequest> entity = new HttpEntity<>(request, headers);

                ResponseEntity<CompletionResponse> response =
                    this.restTemplate.exchange(
                        endpoint.getUrl(), HttpMethod.POST, entity, CompletionResponse.class);
                emitter.onNext(Objects.requireNonNull(response.getBody()));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  public EdgeChain<OpenAiEmbeddingResponse> createEmbeddings(Endpoint endpoint, OpenAiEmbeddingRequest request) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(endpoint.getApiKey());
                HttpEntity<OpenAiEmbeddingRequest> entity = new HttpEntity<>(request, headers);

                ResponseEntity<OpenAiEmbeddingResponse> response =
                    this.restTemplate.exchange(
                        endpoint.getUrl(), HttpMethod.POST, entity, OpenAiEmbeddingResponse.class);

                emitter.onNext(Objects.requireNonNull(response.getBody()));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }
}

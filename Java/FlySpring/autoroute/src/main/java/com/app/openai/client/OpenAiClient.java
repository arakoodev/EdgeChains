package com.app.openai.client;

import com.app.openai.chains.OpenAiChain;
import com.app.openai.embeddings.openai.OpenAiEmbeddingRequest;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.request.ChatCompletionRequest;
import com.app.openai.request.CompletionRequest;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Objects;

@Service
public class OpenAiClient {

  private final RestTemplate restTemplate = new RestTemplate();

  public OpenAiChain createChatCompletion(Endpoint endpoint, ChatCompletionRequest request) {

    return new OpenAiChain(
        Observable.create(
            emitter -> {
              try {

                System.out.println("Logging....");

                // Create headers
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(endpoint.getApiKey());

                HttpEntity<ChatCompletionRequest> entity = new HttpEntity<>(request, headers);

                // Send the POST request
                ResponseEntity<String> response =
                    restTemplate.exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(Objects.requireNonNullElse(response.getBody(), ""));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  public OpenAiChain createCompletion(Endpoint endpoint, CompletionRequest request) {
    return new OpenAiChain(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(endpoint.getApiKey());

                HttpEntity<CompletionRequest> entity = new HttpEntity<>(request, headers);

                ResponseEntity<String> response =
                    this.restTemplate.exchange(
                        endpoint.getUrl(), HttpMethod.POST, entity, String.class);
                emitter.onNext(response.getBody());
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  public OpenAiChain createEmbeddings(Endpoint endpoint, OpenAiEmbeddingRequest request) {
    return new OpenAiChain(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(endpoint.getApiKey());
                HttpEntity<OpenAiEmbeddingRequest> entity = new HttpEntity<>(request, headers);

                ResponseEntity<String> response =
                    this.restTemplate.exchange(
                        endpoint.getUrl(), HttpMethod.POST, entity, String.class);
                emitter.onNext(response.getBody());
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }
}

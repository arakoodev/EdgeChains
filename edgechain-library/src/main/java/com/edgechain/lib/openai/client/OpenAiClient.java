package com.edgechain.lib.openai.client;

import com.edgechain.lib.openai.chains.OpenAiChain;
import com.edgechain.lib.openai.embeddings.models.openai.OpenAiEmbeddingRequest;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
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
                Observable.create(emitter -> {
                    try {

                        System.out.println("Logging....");

                        // Create headers
                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(MediaType.APPLICATION_JSON);
                        headers.setBearerAuth(endpoint.getApiKey());

                        HttpEntity<ChatCompletionRequest> entity = new HttpEntity<>(request, headers);

                        // Send the POST request
                        ResponseEntity<String> response = restTemplate.exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);


                        emitter.onNext(Objects.requireNonNullElse(response.getBody(), ""));
                        emitter.onComplete();
                    } catch (final Exception e) {
                        emitter.onError(e);
                    }

                }), endpoint
        );

    }

    public OpenAiChain createCompletion(Endpoint endpoint, CompletionRequest request) {
        return new OpenAiChain(
                Observable.create(emitter -> {
                    try {
                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(MediaType.APPLICATION_JSON);
                        headers.setBearerAuth(endpoint.getApiKey());

                        HttpEntity<CompletionRequest> entity = new HttpEntity<>(request, headers);

                        ResponseEntity<String> response = this.restTemplate.exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);
                        emitter.onNext(response.getBody());
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                }), endpoint
        );
    }

    public EdgeChain<String> createEmbeddings(Endpoint endpoint, OpenAiEmbeddingRequest request) {
        return new OpenAiChain(
                Observable.create(emitter -> {
                    try {
                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(MediaType.APPLICATION_JSON);
                        headers.setBearerAuth(endpoint.getApiKey());
                        HttpEntity<OpenAiEmbeddingRequest> entity = new HttpEntity<>(request, headers);

                        ResponseEntity<String> response = this.restTemplate.exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                        emitter.onNext(response.getBody());
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                }), endpoint
        );
    }

}

package com.app.openai.embeddings.service.impl;

import com.app.openai.chains.IndexChain;
import com.app.openai.embeddings.WordVec;
import com.app.openai.embeddings.service.EmbeddingService;
import com.app.openai.endpoint.Endpoint;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.*;

public class PineconeEmbeddingService extends EmbeddingService {

  private static final String OPENAI_EMBEDDINGS_API = "https://api.openai.com/v1/embeddings";
  private static final String OPENAI_CHAT_COMPLETION_API =
      "https://api.openai.com/v1/chat/completions";
  private final Endpoint endpoint;
  private final String namespace;

  public PineconeEmbeddingService(Endpoint endpoint, String namespace) {
    this.endpoint = endpoint;
    this.namespace = namespace;
  }

  public PineconeEmbeddingService(Endpoint endpoint) {
    this.endpoint = endpoint;
    this.namespace = "";
  }

  @Override
  public IndexChain upsert(WordVec wordVec) {
    return new IndexChain(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                Map<String, Object> embeddings = new HashMap<>();
                embeddings.put("id", wordVec.getId());
                embeddings.put("values", wordVec.getValues());

                MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
                body.add("vectors", embeddings);
                if (!namespace.isBlank()) body.add("namespace", namespace);

                HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);

                ResponseEntity<String> response =
                    new RestTemplate()
                        .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);
                emitter.onNext(response.getBody());
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  @Override
  public IndexChain predict(String query, String OPENAI_API_KEY) {
    return new IndexChain(
        Observable.create(
            emitter -> {
              try {

                //                        LLMService openAiEmbedding = new LLMService(new
                // OpenAIEmbeddingProvider(
                //                                new
                // Endpoint(OPENAI_EMBEDDINGS_API,OPENAI_API_KEY), "text-embedding-ada-002"));
                //
                //                        List<Double> queryEmbeddings =
                // openAiEmbedding.request(query)
                //                                .transform(response -> new
                // ObjectMapper().readValue(response, OpenAiEmbeddingResponse.class))
                //                                .transform(embeddingResponse ->
                // embeddingResponse.getData().get(0).getEmbedding())
                //                                .getWithRetry();
                //
                //                        HttpHeaders headers = new HttpHeaders();
                //
                // headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                //                        headers.setContentType(MediaType.APPLICATION_JSON);
                //                        headers.set("Api-Key",endpoint.getApiKey());
                //
                //                        // Prepare the request payload using a LinkedHashMap to
                // maintain key order
                //                        Map<String, Object> payload = new LinkedHashMap<>();
                //                        payload.put("includeValues", true);
                //                        payload.put("includeMetadata", false);
                //                        payload.put("vector", queryEmbeddings);
                //                        payload.put("top_k", 1);
                //
                //
                //                        HttpEntity<Map<String, Object>> entity = new
                // HttpEntity<>(payload, headers);
                //
                //                        ResponseEntity<String> response = new
                // RestTemplate().exchange(endpoint.getUrl(), HttpMethod.POST, entity,
                // String.class);
                //
                //                        WordVec wordVec = parsePredict(response.getBody());
                //
                //                        if(Objects.nonNull(wordVec)) {
                //                            LLMProvider llmProvider =
                //                                    new OpenAiChatCompletionProvider
                //                                            (new
                // Endpoint(OPENAI_CHAT_COMPLETION_API, OPENAI_API_KEY), "gpt-3.5-turbo", "user");
                //
                //                            LLMService chatCompletion = new
                // LLMService(llmProvider);
                //
                //                            String prompt = new ChatQueryPrompt().getPrompt() +
                // "\n" + query;
                //                            String responseBody =
                // chatCompletion.request(prompt).getWithRetry();
                //                            emitter.onNext(parseChatCompletion(responseBody));
                //                        }
                //                        else{
                //                            emitter.onNext("Unable to extract information...");
                //                        }

                emitter.onComplete(); // Complete Signal Necessary

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  @Override
  public IndexChain predict(String query, Double temperature, String OPENAI_API_KEY) {

    return new IndexChain(
        Observable.create(
            emitter -> {
              try {

                //                        LLMService openAiEmbedding = new LLMService(new
                // OpenAIEmbeddingProvider(
                //                                new
                // Endpoint(OPENAI_EMBEDDINGS_API,OPENAI_API_KEY), "text-embedding-ada-002"));
                //
                //                        List<Double> queryEmbeddings =
                // openAiEmbedding.request(query)
                //                                .transform(response -> new
                // ObjectMapper().readValue(response, OpenAiEmbeddingResponse.class))
                //                                .transform(embeddingResponse ->
                // embeddingResponse.getData().get(0).getEmbedding())
                //                                .getWithRetry();
                //
                //                        HttpHeaders headers = new HttpHeaders();
                //
                // headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                //                        headers.setContentType(MediaType.APPLICATION_JSON);
                //                        headers.set("Api-Key",endpoint.getApiKey());
                //
                //                        // Prepare the request payload using a LinkedHashMap to
                // maintain key order
                //                        Map<String, Object> payload = new LinkedHashMap<>();
                //                        payload.put("includeValues", true);
                //                        payload.put("includeMetadata", false);
                //                        payload.put("vector", queryEmbeddings);
                //                        payload.put("top_k", 1);
                //
                //
                //                        HttpEntity<Map<String, Object>> entity = new
                // HttpEntity<>(payload, headers);
                //
                //                        ResponseEntity<String> response = new
                // RestTemplate().exchange(endpoint.getUrl(), HttpMethod.POST, entity,
                // String.class);
                //
                //                        WordVec wordVec = parsePredict(response.getBody());
                //
                //                        if(Objects.nonNull(wordVec)) {
                //                            LLMProvider llmProvider =
                //                                    new OpenAiChatCompletionProvider
                //                                            (new
                // Endpoint(OPENAI_CHAT_COMPLETION_API, OPENAI_API_KEY), "gpt-3.5-turbo", "user",
                // temperature);
                //
                //                            LLMService chatCompletion = new
                // LLMService(llmProvider);
                //
                //                            String prompt = new ChatQueryPrompt().getPrompt() +
                // "\n" + query;
                //                            String responseBody =
                // chatCompletion.request(prompt).getWithRetry();
                //                            emitter.onNext(parseChatCompletion(responseBody));
                //                        }
                //                        else{
                //                            emitter.onNext("Unable to extract information...");
                //                        }

                emitter.onComplete(); // Complete Signal Necessary

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  @Override
  public IndexChain delete() {
    return new IndexChain(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                Map<String, Object> body = new HashMap<>();
                body.put("deleteAll", true);

                if (!namespace.isEmpty()) body.put("namespace", namespace);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                ResponseEntity<String> responseEntity =
                    new RestTemplate()
                        .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);
                emitter.onNext(responseEntity.getBody());
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  private String parseChatCompletion(String body) throws JsonProcessingException {
    JsonNode outputJsonNode = new ObjectMapper().readTree(body);
    System.out.println("Pretty String: " + outputJsonNode.toPrettyString());

    return outputJsonNode.get("choices").get(0).get("message").get("content").asText();
  }

  private WordVec parsePredict(String body) throws JsonProcessingException {

    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode outputJsonNode = objectMapper.readTree(body);
    System.out.println("Pretty String: " + outputJsonNode.toPrettyString());

    return objectMapper.treeToValue(outputJsonNode.get("matches").get(0), WordVec.class);
  }
}

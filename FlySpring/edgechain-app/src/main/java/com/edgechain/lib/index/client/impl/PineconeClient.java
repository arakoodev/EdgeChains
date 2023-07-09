package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.index.request.pinecone.PineconeUpsert;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.*;

public class PineconeClient {

  private final PineconeEndpoint endpoint;
  private final String namespace;

  public PineconeClient(PineconeEndpoint endpoint, String namespace) {
    this.endpoint = endpoint;
    this.namespace = (Objects.isNull(namespace) || namespace.isEmpty()) ? "" : namespace;
  }

  public EdgeChain<StringResponse> upsert(WordEmbeddings wordEmbeddings) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                PineconeUpsert pinecone = new PineconeUpsert();
                pinecone.setVectors(List.of(wordEmbeddings));
                pinecone.setNamespace(namespace);

                HttpEntity<PineconeUpsert> entity = new HttpEntity<>(pinecone, headers);

                ResponseEntity<String> response =
                    new RestTemplate()
                        .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(new StringResponse(response.getBody()));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  public EdgeChain<List<WordEmbeddings>> query(WordEmbeddings wordEmbeddings, int topK) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                // Prepare the request payload using a LinkedHashMap to maintain key order
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("includeValues", true);
                payload.put("includeMetadata", false);
                payload.put("vector", wordEmbeddings.getValues());
                payload.put("top_k", topK);
                payload.put("namespace", this.namespace);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

                ResponseEntity<String> response =
                    new RestTemplate()
                        .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(this.parsePredict(response.getBody()));

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  public EdgeChain<StringResponse> deleteAll() {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                Map<String, Object> body = new HashMap<>();
                body.put("deleteAll", true);
                body.put("namespace", namespace);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                new RestTemplate()
                    .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(new StringResponse("Word embeddings deleted successfully."));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  private List<WordEmbeddings> parsePredict(String body) throws IOException {
    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode jsonNode = objectMapper.readTree(body);

    int matches = jsonNode.get("matches").size();
    List<WordEmbeddings> words2VecList = new ArrayList<>();

    for (int i = 0; i < matches; i++) {
      words2VecList.add(
          objectMapper.treeToValue(jsonNode.get("matches").get(i), WordEmbeddings.class));
    }

    return words2VecList;
  }
}

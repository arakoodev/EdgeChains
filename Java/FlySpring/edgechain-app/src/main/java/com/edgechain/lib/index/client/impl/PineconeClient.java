package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.endpoint.impl.index.PineconeEndpoint;
import com.edgechain.lib.index.request.pinecone.PineconeUpsert;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.*;

@Service
public class PineconeClient {

  public EdgeChain<StringResponse> upsert(PineconeEndpoint endpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                PineconeUpsert pinecone = new PineconeUpsert();
                pinecone.setVectors(List.of(endpoint.getWordEmbedding()));
                pinecone.setNamespace(getNamespace(endpoint));

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

  public EdgeChain<StringResponse> batchUpsert(PineconeEndpoint endpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                PineconeUpsert pinecone = new PineconeUpsert();
                pinecone.setVectors(endpoint.getWordEmbeddingsList());
                pinecone.setNamespace(getNamespace(endpoint));

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

  public EdgeChain<List<WordEmbeddings>> query(PineconeEndpoint endpoint) {

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
                payload.put("vector", endpoint.getWordEmbedding().getValues());
                payload.put("top_k", endpoint.getTopK());
                payload.put("namespace", getNamespace(endpoint));

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

  public EdgeChain<StringResponse> deleteAll(PineconeEndpoint endpoint) {

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
                body.put("namespace", getNamespace(endpoint));

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                new RestTemplate()
                    .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(
                    new StringResponse(
                        "Word embeddings are successfully deleted for namespace:"
                            + getNamespace(endpoint)));
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

  public String getNamespace(PineconeEndpoint endpoint) {
    return (Objects.isNull(endpoint.getNamespace()) || endpoint.getNamespace().isEmpty())
        ? ""
        : endpoint.getNamespace();
  }
}

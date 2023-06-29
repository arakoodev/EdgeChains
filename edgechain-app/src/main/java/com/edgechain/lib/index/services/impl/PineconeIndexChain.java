package com.edgechain.lib.index.services.impl;

import com.edgechain.lib.openai.chains.IndexChain;
import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.index.services.IndexChainService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.*;

public class PineconeIndexChain extends IndexChainService {

  private final Endpoint endpoint;
  private final String namespace;

  public PineconeIndexChain(Endpoint endpoint, String namespace) {
    this.endpoint = endpoint;
    this.namespace = namespace;
  }

  public PineconeIndexChain(Endpoint endpoint) {
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

                emitter.onNext(new ChainResponse(response.getBody()));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  @Override
  public EdgeChain<List<WordVec>> query(WordVec wordVec, int topK) {

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
                payload.put("vector", wordVec.getValues());
                payload.put("top_k", topK);

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

  @Override
  public IndexChain deleteByIds(List<String> vectorIds) {
    return new IndexChain(
        Observable.create(
            emitter -> {
              try {
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Api-Key", endpoint.getApiKey());

                Map<String, Object> body = new HashMap<>();

                body.put("ids", vectorIds);
                body.put("deleteAll", false);

                if (!namespace.isEmpty()) body.put("namespace", namespace);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                new RestTemplate()
                    .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(
                    new ChainResponse(
                        "Word embeddings of the provided ids are successfully deleted"));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  @Override
  public IndexChain deleteAll() {
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

                new RestTemplate()
                    .exchange(endpoint.getUrl(), HttpMethod.POST, entity, String.class);

                emitter.onNext(new ChainResponse("Word embeddings deleted successfully."));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  private List<WordVec> parsePredict(String body) throws IOException {
    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode jsonNode = objectMapper.readTree(body);

    int matches = jsonNode.get("matches").size();
    List<WordVec> wordVecList = new ArrayList<>();

    for (int i = 0; i < matches; i++) {
      wordVecList.add(objectMapper.treeToValue(jsonNode.get("matches").get(i), WordVec.class));
    }

    return wordVecList;
  }
}

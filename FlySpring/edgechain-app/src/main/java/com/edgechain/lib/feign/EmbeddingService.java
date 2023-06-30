package com.edgechain.lib.feign;

import com.edgechain.lib.request.Doc2VecEmbeddingsRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "embeddingService", url = "${server.url}/embeddings")
@Component
public interface EmbeddingService {

  @PostMapping(
      value = "/openai",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse openAi(@RequestBody OpenAiEmbeddingsRequest request);

  @PostMapping(
      value = "/doc2vec",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse doc2Vec(@RequestBody Doc2VecEmbeddingsRequest request);
}

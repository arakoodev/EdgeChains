package com.edgechain.app.services;

import com.edgechain.app.request.OpenAiChatRequest;
import com.edgechain.app.request.OpenAiCompletionRequest;
import com.edgechain.app.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "openAiService", url = "${feign.url}/openai")
@Component
public interface OpenAiService extends ToolService {

  @PostMapping(
      value = "/chat-completion",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse chatCompletion(@RequestBody OpenAiChatRequest request);

  @PostMapping(
      value = "/completion",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse completion(@RequestBody OpenAiCompletionRequest request);

  @PostMapping(
      value = "/embeddings",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse embeddings(@RequestBody OpenAiEmbeddingsRequest request);
}

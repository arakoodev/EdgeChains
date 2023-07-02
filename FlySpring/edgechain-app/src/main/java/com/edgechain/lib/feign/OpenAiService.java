package com.edgechain.lib.feign;

import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
import com.edgechain.lib.openai.request.feign.OpenAiChatRequest;
import com.edgechain.lib.openai.request.feign.OpenAiCompletionRequest;
import com.edgechain.lib.openai.request.feign.OpenAiEmbeddingsRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "openAiService", url = "${feign.host}:${server.port}/v2/openai")
@Component
public interface OpenAiService {

  @PostMapping(
      value = "/chat-completion",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE,MediaType.TEXT_EVENT_STREAM_VALUE})
  ChatCompletionResponse chatCompletion(@RequestBody OpenAiChatRequest request);

  @PostMapping(
      value = "/completion",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  CompletionResponse completion(@RequestBody OpenAiCompletionRequest request);

  @PostMapping(
          value = "/embeddings",
          consumes = {MediaType.APPLICATION_JSON_VALUE},
          produces = {MediaType.APPLICATION_JSON_VALUE})
  OpenAiEmbeddingResponse embeddings(@RequestBody OpenAiEmbeddingsRequest request);

}

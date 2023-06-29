package com.edgechain.lib.feign;

import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.request.OpenAiCompletionRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "openAiService", url = "${feign.url}/openai")
@Component
public interface OpenAiService {

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
}

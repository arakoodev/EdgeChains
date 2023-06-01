package com.edgechain.service.controllers;

import com.edgechain.lib.openai.providers.OpenAiChatCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiEmbeddingProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import com.edgechain.service.request.OpenAiChatRequest;
import com.edgechain.service.request.OpenAiCompletionRequest;
import com.edgechain.service.request.OpenAiEmbeddingsRequest;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/openai")
public class OpenAiController {

  @PostMapping("/chat-completion")
  public Mono<ChainResponse> chatCompletion(@RequestBody OpenAiChatRequest request) {

    OpenAiChatCompletionProvider chatCompletion =
        new OpenAiChatCompletionProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), chatCompletion).toSingleWithRetry());
  }

  @PostMapping("/completion")
  public Mono<ChainResponse> completion(@RequestBody OpenAiCompletionRequest request) {

    OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), provider).toSingleWithRetry());
  }

  @PostMapping("/embeddings")
  public Mono<ChainResponse> embeddings(@RequestBody OpenAiEmbeddingsRequest request) {
    ChainProvider embeddings = new OpenAiEmbeddingProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), embeddings).toSingleWithRetry());
  }
}

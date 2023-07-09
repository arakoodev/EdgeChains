package com.edgechain.service.controllers.openai;

import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
import com.edgechain.lib.openai.request.feign.OpenAiChatRequest;
import com.edgechain.lib.openai.request.feign.OpenAiCompletionRequest;
import com.edgechain.lib.openai.request.feign.OpenAiEmbeddingsRequest;

import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController("Service OpenAiController")
@RequestMapping(value = "/v2/openai")
public class OpenAiController {

  @PostMapping(value = "/chat-completion")
  public Single<ChatCompletionResponse> chatCompletion(@RequestBody OpenAiChatRequest request) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(request.getEndpoint().getModel())
            .temperature(request.getEndpoint().getTemperature())
            .messages(List.of(new ChatMessage(request.getEndpoint().getRole(), request.getInput())))
            .stream(request.getEndpoint().getStream())
            .build();

    EdgeChain<ChatCompletionResponse> edgeChain =
        new OpenAiClient(request.getEndpoint()).createChatCompletion(chatCompletionRequest);

    return edgeChain.toSingle();
  }

  @PostMapping(
      value = "/chat-completion-stream",
      consumes = {MediaType.APPLICATION_JSON_VALUE})
  public SseEmitter chatCompletionStream(@RequestBody OpenAiChatRequest request) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(request.getEndpoint().getModel())
            .temperature(request.getEndpoint().getTemperature())
            .messages(List.of(new ChatMessage(request.getEndpoint().getRole(), request.getInput())))
            .stream(true)
            .build();

    SseEmitter emitter = new SseEmitter();
    ExecutorService executorService = Executors.newSingleThreadExecutor();

    executorService.execute(
        () -> {
          try {
            EdgeChain<ChatCompletionResponse> edgeChain =
                new OpenAiClient(request.getEndpoint())
                    .createChatCompletionStream(chatCompletionRequest);

            Observable<ChatCompletionResponse> obs = edgeChain.getScheduledObservable();

            obs.subscribe(
                res -> {
                  try {
                    emitter.send(res);
                    if (Objects.nonNull(res.getChoices().get(0).getFinishReason())) {
                      emitter.complete();
                    }
                  } catch (final Exception e) {
                    emitter.completeWithError(e);
                  }
                });
          } catch (final Exception e) {
            emitter.completeWithError(e);
          }
        });
    executorService.shutdown();
    return emitter;
  }

  @PostMapping("/completion")
  public Single<CompletionResponse> completion(@RequestBody OpenAiCompletionRequest request) {

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(request.getInput())
            .model(request.getEndpoint().getModel())
            .temperature(request.getEndpoint().getTemperature())
            .build();

    EdgeChain<CompletionResponse> edgeChain =
        new OpenAiClient(request.getEndpoint()).createCompletion(completionRequest);

    return edgeChain.toSingle();
  }

  @PostMapping("/embeddings")
  public Single<OpenAiEmbeddingResponse> embeddings(@RequestBody OpenAiEmbeddingsRequest request) {

    EdgeChain<OpenAiEmbeddingResponse> edgeChain =
        new OpenAiClient(request.getEndpoint())
            .createEmbeddings(
                new OpenAiEmbeddingRequest(request.getEndpoint().getModel(), request.getInput()));

    return edgeChain.toSingle();
  }
}

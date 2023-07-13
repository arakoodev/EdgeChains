package com.edgechain.service.controllers.openai;

import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
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
  public Single<ChatCompletionResponse> chatCompletion(@RequestBody OpenAiEndpoint openAiEndpoint) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(openAiEndpoint.getModel())
            .temperature(openAiEndpoint.getTemperature())
            .messages(List.of(new ChatMessage(openAiEndpoint.getRole(), openAiEndpoint.getInput())))
            .stream(false)
            .build();

    EdgeChain<ChatCompletionResponse> edgeChain =
        new OpenAiClient(openAiEndpoint).createChatCompletion(chatCompletionRequest);

    return edgeChain.toSingle();
  }

  @PostMapping(
      value = "/chat-completion-stream",
      consumes = {MediaType.APPLICATION_JSON_VALUE})
  public SseEmitter chatCompletionStream(@RequestBody OpenAiEndpoint openAiEndpoint) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(openAiEndpoint.getModel())
            .temperature(openAiEndpoint.getTemperature())
            .messages(List.of(new ChatMessage(openAiEndpoint.getRole(), openAiEndpoint.getInput())))
            .stream(true)
            .build();

    SseEmitter emitter = new SseEmitter();
    ExecutorService executorService = Executors.newSingleThreadExecutor();

    executorService.execute(
        () -> {
          try {
            EdgeChain<ChatCompletionResponse> edgeChain =
                new OpenAiClient(openAiEndpoint).createChatCompletionStream(chatCompletionRequest);

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
  public Single<CompletionResponse> completion(@RequestBody OpenAiEndpoint openAiEndpoint) {

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(openAiEndpoint.getInput())
            .model(openAiEndpoint.getModel())
            .temperature(openAiEndpoint.getTemperature())
            .build();

    EdgeChain<CompletionResponse> edgeChain =
        new OpenAiClient(openAiEndpoint).createCompletion(completionRequest);

    return edgeChain.toSingle();
  }

  @PostMapping("/embeddings")
  public Single<OpenAiEmbeddingResponse> embeddings(@RequestBody OpenAiEndpoint openAiEndpoint) {

    EdgeChain<OpenAiEmbeddingResponse> edgeChain =
        new OpenAiClient(openAiEndpoint)
            .createEmbeddings(
                new OpenAiEmbeddingRequest(openAiEndpoint.getModel(), openAiEndpoint.getInput()));

    return edgeChain.toSingle();
  }
}

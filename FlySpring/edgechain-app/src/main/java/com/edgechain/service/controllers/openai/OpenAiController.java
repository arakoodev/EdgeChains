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

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("Service OpenAiController")
@RequestMapping(value =  "/v2/openai")
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

     return new OpenAiClient().createChatCompletion(request.getEndpoint(), chatCompletionRequest)
             .toSingleWithRetry();

  }

  @PostMapping(
      value = "/chat-completion-stream",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<ChatCompletionResponse> chatCompletionStream(@RequestBody OpenAiChatRequest request) {

    ChatCompletionRequest chatCompletionRequest =
            ChatCompletionRequest.builder()
                    .model(request.getEndpoint().getModel())
                    .temperature(request.getEndpoint().getTemperature())
                    .messages(List.of(new ChatMessage(request.getEndpoint().getRole(), request.getInput())))
                    .stream(true)
                    .build();

    return new OpenAiClient().createChatCompletionStream(request.getEndpoint(), chatCompletionRequest)
            .getScheduledObservableWithRetry();
  }

  @PostMapping("/completion")
  public Single<CompletionResponse> completion(@RequestBody OpenAiCompletionRequest request) {

    CompletionRequest completionRequest =
            CompletionRequest.builder()
                    .prompt(request.getInput())
                    .model(request.getEndpoint().getModel())
                    .temperature(request.getEndpoint().getTemperature())
                    .build();

    return new OpenAiClient().createCompletion(request.getEndpoint(), completionRequest).toSingleWithRetry();
  }

  @PostMapping("/embeddings")
  public Single<OpenAiEmbeddingResponse> embeddings(@RequestBody OpenAiEmbeddingsRequest request) {
    return new OpenAiClient()
            .createEmbeddings(
                    request.getEndpoint(), new OpenAiEmbeddingRequest(request.getEndpoint().getModel(), request.getInput()))
            .toSingleWithRetry();

  }


}
